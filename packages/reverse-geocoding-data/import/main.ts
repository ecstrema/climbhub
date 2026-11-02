// Imports the regions of regions.ts from OpenStreetMap into data/world: `bun run import`.
//
// 1. Downloads the regions that are not in data/ yet, one Overpass request at a time, DELAY apart,
//    retrying on errors, in passes until everything is downloaded. The responses are cached in raw/
//    (not committed): run it again to resume after an interruption.
// 2. After each download, converts raw/ to new data/ files. Every boundary is simplified with its
//    own tolerance (raised until the file is small enough); a border shared by several boundaries
//    uses the largest of their tolerances, so that it stays identical in all of them. The new
//    boundaries are snapped onto the borders of the existing files.
//
// Only adds files: a path that exists in data/ is never written again, so the edits made in
// /edit-map are kept. A region is done once it was imported (listed in import/imported.json), or
// its path exists: the regions deleted, merged or renamed in /edit-map are not imported again.
//
// `--dry`: no download, shows what raw/ would add to data/.
// `--audit`: downloads every region (done or not) into raw/, and lists the files of data/ that are
//   far from their OSM boundary (badly simplified, or a part missing).
// `--redo <path>...`: imports these paths of data/world again, replacing them. A directory is
//   deleted, and downloaded and imported again like a new region; a file is rebuilt in place, from
//   raw/.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "fs";
import type { Position } from "geojson";
import osmtogeojson from "osmtogeojson";
import {
  boundaryPolygons,
  polygonsContain,
  preparePolygons,
  toBoundary,
} from "../../app/src/routes/edit-map/geometry.ts";
import { USER_AGENT } from "../src/config.ts";
import { slugify } from "../src/shared.ts";
import { REGIONS, type Region } from "./regions.ts";

const RAW = `${import.meta.dirname}/raw`;
const DATA = `${import.meta.dirname}/../data/world`;
const DRY = process.argv.includes("--dry");
const AUDIT = process.argv.includes("--audit");
/** Codes of the regions imported once, even if their files were deleted or renamed since */
const IMPORTED_FILE = `${import.meta.dirname}/imported.json`;
const imported = new Set<string>(existsSync(IMPORTED_FILE) ? JSON.parse(readFileSync(IMPORTED_FILE, "utf8")) : []);
const saveImported = () => !DRY && writeFileSync(IMPORTED_FILE, JSON.stringify([...imported].sort(), null, 1) + "\n");
const pathExists = (path: string) => existsSync(`${DATA}/${path}`) || existsSync(`${DATA}/${path}.geojson`);
// Before imported.json, a region was done when its path existed
if (!existsSync(IMPORTED_FILE)) {
  for (const region of REGIONS) if (pathExists(region.path)) imported.add(region.code);
  saveImported();
}

/** The files of --redo, without the extension */
const REDO = new Set<string>();
for (const arg of process.argv.slice(process.argv.indexOf("--redo") + 1)) {
  if (!process.argv.includes("--redo") || arg.startsWith("--")) break;
  const path = arg.replace(/^.*data\/world\//, "").replace(/\.geojson$/, "").replace(/\/$/, "");
  if (statSync(`${DATA}/${path}`, { throwIfNoEntry: false })?.isDirectory()) {
    if (!DRY) {
      rmSync(`${DATA}/${path}`, { recursive: true });
      // raw/ may have the subdivisions of another admin_level
      for (const region of REGIONS) {
        if (region.path !== path && !region.path.startsWith(`${path}/`)) continue;
        rmSync(`${RAW}/${region.code}.json`, { force: true });
        imported.delete(region.code);
      }
      saveImported();
    }
    console.log(`Deleted ${path}/, imported again`);
  } else if (existsSync(`${DATA}/${path}.geojson`)) REDO.add(path);
  else throw new Error(`--redo: no ${path} in data/world`);
}

/** Before every Overpass request, retries included */
const DELAY = 10_000;
/** Aborts a request that hangs, the query itself times out after 300s */
const REQUEST_TIMEOUT = 600_000;
/** Of a request in a pass: a request that still fails is retried in the next pass */
const MAX_ATTEMPTS = 8;
/** Passes over the regions that are not downloaded yet */
const MAX_DOWNLOAD_PASSES = 20;
/** Leaves downloaded together */
const BATCH = 4;

const BASE_TOLERANCE = 0.002;
/** A larger tolerance breaks the boundaries (a region becomes a triangle...): larger files are written anyway */
const MAX_TOLERANCE = 0.01;
const MAX_BYTES = 48 * 1024;
/** Above this distance (in degrees) from its OSM boundary, --audit lists a file */
const AUDIT_THRESHOLD = 0.02;

/** Whether the region was imported, or is in data/ (a file of it, or of its subdivisions for a group) */
const isDone = (region: Region) => imported.has(region.code) || pathExists(region.path);
/** Whether the region has files to rebuild with --redo */
const isRedone = (region: Region) =>
  [...REDO].some((path) => path === region.path || path.startsWith(`${region.path}/`));
const rawFile = (region: Region) => `${RAW}/${region.code}.json`;
const codeOf = (tags: any) => tags?.["ISO3166-2"] ?? tags?.["ISO3166-1"];
/** Whether the OSM element (raw/) or GeoJSON feature is the relation of the region */
const isElementOf = (region: Region, e: any) =>
  region.osm ? e.type === "relation" && e.id === region.osm : codeOf(e.tags) === region.code;
const isFeatureOf = (region: Region, f: any) =>
  region.osm ? f.properties?.id === `relation/${region.osm}` : codeOf(f.properties) === region.code;

// --- Download -----------------------------------------------------------------------------------

const selector = (region: Region) =>
  region.osm
    ? `rel(${region.osm})`
    : region.code.includes("-")
    ? `rel["boundary"="administrative"]["ISO3166-2"="${region.code}"]`
    : `rel["boundary"="administrative"]["admin_level"="2"]["ISO3166-1"="${region.code}"]`;

function query(regions: Region[]) {
  const [first] = regions;
  if (first!.children) {
    return `[out:json][timeout:300];
${selector(first!)}->.r;
.r out geom;
.r map_to_area->.a;
rel(area.a)["boundary"="administrative"]["admin_level"="${first!.children}"];
out geom;`;
  }
  return `[out:json][timeout:180];
(${regions.map((r) => `${selector(r)};`).join(" ")});
out geom;`;
}

/** Leaves of the same batch key are downloaded together: the subdivisions of a country, or the countries of a continent */
const batchKey = (region: Region) =>
  region.code.includes("-") ? region.code.split("-")[0] : region.path.split("/")[0];

/** Downloads the request, `undefined` on an error */
async function fetchElements(regions: Region[]): Promise<any[] | undefined> {
  const names = regions.map((r) => r.code).join(" ");
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await Bun.sleep(DELAY);
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query(regions),
      headers: { "Content-Type": "text/plain; charset=utf-8", "User-Agent": USER_AGENT },
      // The server sometimes never answers
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    }).catch((e) => ({ ok: false, status: String(e), text: async () => "" }) as any);
    const text = await res.text().catch(() => "");
    let message = text.match(/Error<\/strong>: ([^<]{0,120})/)?.[1] ?? "";
    if (res.ok) {
      try {
        const { elements, remark } = JSON.parse(text);
        // A timeout or out of memory is a 200 with a partial result and a remark
        if (!remark?.includes("error")) return elements;
        message = remark;
      } catch (e) {
        message = String(e);
      }
    }
    console.log(`  ${names}: ${res.status} (attempt ${attempt}) ${message.slice(0, 160)}`);
  }
  console.log(`  ${names}: failed, retried in the next pass`);
}

async function download() {
  mkdirSync(RAW, { recursive: true });
  /** Regions that are not in OpenStreetMap: not requested again */
  const notFound = new Set<Region>();
  for (let pass = 1; pass <= MAX_DOWNLOAD_PASSES; pass++) {
    const pending = REGIONS.filter(
      (r) => (AUDIT || !isDone(r) || isRedone(r)) && !existsSync(rawFile(r)) && !notFound.has(r),
    );
    // A group is one request
    const requests: Region[][] = [];
    for (const region of pending) {
      const last = requests.at(-1);
      if (!region.children && last && !last[0]!.children && batchKey(last[0]!) === batchKey(region) && last.length < BATCH)
        last.push(region);
      else requests.push([region]);
    }
    console.log(`Pass ${pass}: ${pending.length} regions to download in ${requests.length} requests`);
    if (DRY || !requests.length) return;

    for (const [i, regions] of requests.entries()) {
      console.log(`[${i + 1}/${requests.length}] ${regions.map((r) => r.code).join(" ")}`);
      const elements = await fetchElements(regions);
      if (!elements) continue;
      for (const region of regions) {
        const own = elements.filter((e: any) => isElementOf(region, e));
        if (!own.length) {
          console.log(`  ${region.code}: NOT FOUND in OpenStreetMap`);
          notFound.add(region);
          continue;
        }
        // A group keeps the subdivisions downloaded with it
        const kept = region.children ? elements : own;
        writeFileSync(rawFile(region), JSON.stringify({ elements: kept }));
        console.log(`  ${region.code}: ${Math.round(JSON.stringify(kept).length / 1024)} KB → ${region.path}`);
      }
      try {
        if (!AUDIT) build();
      } catch (e) {
        console.log(`  build failed: ${e}`);
      }
    }
  }
  const missing = REGIONS.filter((r) => !isDone(r));
  if (missing.length) console.log(`Not imported: ${missing.map((r) => r.code).join(" ")}`);
}

// --- Build --------------------------------------------------------------------------------------

type Item = { path: string; feature: any };
const key = (p: Position) => `${p[0]},${p[1]}`;

/** Slug of the name in the given language, without the other languages of bilingual names ("Cymru / Wales") */
function slugOf(tags: any, lang: string): string {
  for (const name of [tags[`name:${lang}`], tags["int_name"], tags.name]) {
    const slug = slugify(String(name ?? "").split("/")[0]!.trim()).replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (slug) return slug;
  }
  // A name in another script (Arabic, Chinese...) without a Latin name
  return slugify(codeOf(tags) ?? `osm-${tags.id}`);
}

function verticesOf(feature: any) {
  const vertices = new Set<string>();
  for (const polygon of boundaryPolygons({ type: "FeatureCollection", features: [feature] }))
    for (const ring of polygon) for (const p of ring) vertices.add(key(p));
  return vertices;
}

/** [west, south, east, north] */
function bboxOf(feature: any) {
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];
  for (const polygon of boundaryPolygons({ type: "FeatureCollection", features: [feature] })) {
    for (const [x, y] of polygon[0]!) {
      bbox[0] = Math.min(bbox[0]!, x!); bbox[1] = Math.min(bbox[1]!, y!);
      bbox[2] = Math.max(bbox[2]!, x!); bbox[3] = Math.max(bbox[3]!, y!);
    }
  }
  return bbox;
}

/** Whether most of the bounding box `a` is in `b`: a cheap test before {@link overlaps} */
function bboxMostlyIn(a: number[], b: number[]) {
  const width = Math.min(a[2]!, b[2]!) - Math.max(a[0]!, b[0]!);
  const height = Math.min(a[3]!, b[3]!) - Math.max(a[1]!, b[1]!);
  return width > 0 && height > 0 && width * height > ((a[2]! - a[0]!) * (a[3]! - a[1]!)) / 2;
}

type Prepared = ReturnType<typeof preparePolygons>;
const prepare = (feature: any) => preparePolygons(boundaryPolygons({ type: "FeatureCollection", features: [feature] }));

/** Whether most of `own` is inside `other`, sampled on a grid of its bounding box */
function overlaps(own: Prepared, bbox: number[], other: Prepared) {
  const N = 10;
  let samples = 0;
  let inOther = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = bbox[0]! + ((i + 0.5) / N) * (bbox[2]! - bbox[0]!);
      const y = bbox[1]! + ((j + 0.5) / N) * (bbox[3]! - bbox[1]!);
      if (!polygonsContain(own, x, y)) continue;
      samples++;
      if (polygonsContain(other, x, y)) inOther++;
    }
  }
  return samples > 0 && inOther > samples / 2;
}

/** Vertices tested by {@link isInside}: the borders of large countries have millions */
const MAX_TESTED_VERTICES = 200;

/** Whether `child` is inside `region`: most of its vertices not on the region border are inside */
function isInside(child: any, region: Prepared, regionVertices: Set<string>) {
  const candidates: Position[] = [];
  for (const polygon of boundaryPolygons({ type: "FeatureCollection", features: [child] }))
    for (const p of polygon[0]!) if (!regionVertices.has(key(p))) candidates.push(p);
  const step = Math.max(1, Math.floor(candidates.length / MAX_TESTED_VERTICES));
  let inside = 0;
  let outside = 0;
  for (let i = 0; i < candidates.length; i += step) {
    if (polygonsContain(region, candidates[i]![0]!, candidates[i]![1]!)) inside++;
    else outside++;
  }
  return inside >= outside;
}

/** The region as a group of the subdivisions inside it, or as a leaf without subdivisions */
function groupItems(features: any[], region: any, code: string, base: string, lang: string, childLevel: string): Item[] {
  const regionVertices = verticesOf(region);
  const regionPrepared = prepare(region);
  const inside = features.filter(
    (f: any) => f !== region && f.properties?.admin_level === childLevel && isInside(f, regionPrepared, regionVertices),
  );
  // A disputed area is mapped by both countries (Crimea in Ukraine and Russia...): drop the
  // subdivisions of another country, and of the ones that overlap, keep the one with the ISO3166-2
  // code of the country
  const country = code.split("-")[0];
  const iso = (f: any): string | undefined => f.properties["ISO3166-2"];
  const official = (f: any) => (iso(f)?.startsWith(`${country}-`) ? 1 : 0);
  const children: any[] = [];
  const kept: { feature: any; bbox: number[]; prepared: Prepared }[] = [];
  for (const feature of inside.sort((a: any, b: any) => official(b) - official(a))) {
    const bbox = bboxOf(feature);
    const prepared = prepare(feature);
    const overlapped = kept.find((k) => bboxMostlyIn(bbox, k.bbox) && overlaps(prepared, bbox, k.prepared));
    const foreign = iso(feature)?.includes("-") && !official(feature);
    if (overlapped || foreign) {
      const reason = foreign ? `of another country (${iso(feature)})` : `overlaps ${overlapped!.feature.properties.name}`;
      console.log(`  ${base}: skipped ${feature.properties.name} (${feature.properties.id}), ${reason}`);
      continue;
    }
    children.push(feature);
    kept.push({ feature, bbox, prepared });
  }
  // A region without subdivisions (Berlin, Madrid...) is a leaf
  if (children.length <= 1) {
    console.log(`  ${base}: leaf (no subdivision of admin_level ${childLevel})`);
    return [{ path: base, feature: region }];
  }
  const used = new Set<string>();
  return children.map((feature: any) => {
    let slug = slugOf(feature.properties, lang);
    if (used.has(slug)) slug = `${slug}-${slugify(codeOf(feature.properties) ?? String(feature.properties.id))}`;
    used.add(slug);
    return { path: `${base}/${slug}`, feature };
  });
}

/** The vertices and edges of the existing files of data/, which the new boundaries are snapped onto */
let existingVertices = new Set<string>();
let existingEdges = new Set<string>();
/** For each vertex of the new boundaries, the boundaries using it */
let sharers = new Map<string, number[]>();
const sharersKey = (p: Position) => sharers.get(key(p))!.join(",");
const locked = (p: Position) => existingVertices.has(key(p));

/** The features of the region in raw/, `own` being its relation */
function rawFeatures(region: Region) {
  const features: any[] = toBoundary(osmtogeojson(JSON.parse(readFileSync(rawFile(region), "utf8")))).features;
  return { features, own: features.find((f: any) => isFeatureOf(region, f)) };
}

/** Converts what raw/ has for the regions not done yet (and the files of --redo) to new files of data/ */
function build() {
  let items: Item[] = [];
  /** The regions not done yet, imported by this build */
  const built: Region[] = [];
  for (const region of REGIONS) {
    const redone = isRedone(region);
    if ((isDone(region) && !redone) || !existsSync(rawFile(region))) continue;
    const { features, own } = rawFeatures(region);
    if (!own) {
      console.log(`  ${region.path}: no geometry for ${region.code} in raw/, delete raw/${region.code}.json to download it again`);
      continue;
    }
    const regionItems = region.children
      ? groupItems(features, own, region.code, region.path, region.lang ?? "en", region.children)
      : [{ path: region.path, feature: own }];
    if (!isDone(region)) built.push(region);
    // Of a region done, only the files of --redo
    items.push(...(isDone(region) ? regionItems.filter((item) => REDO.has(item.path)) : regionItems));
  }
  if (!items.length) return;

  const seen = new Map<string, Item>();
  for (const item of items) {
    if (seen.has(item.path)) {
      throw new Error(`Duplicate ${item.path}: ${seen.get(item.path)!.feature.properties.name} / ${item.feature.properties.name}`);
    }
    seen.set(item.path, item);
  }

  // Only the new paths, snapped onto the borders of the existing files. The files of --redo are
  // replaced: they are not existing ones.
  const existing: Position[][] = [];
  const existingPaths = new Set<string>();
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${dir}/${e.name}`);
      else if (e.name.endsWith(".geojson")) {
        const path = `${dir}/${e.name}`.slice(DATA.length + 1, -".geojson".length);
        if (REDO.has(path)) continue;
        existingPaths.add(path);
        for (const polygon of boundaryPolygons(JSON.parse(readFileSync(`${dir}/${e.name}`, "utf8"))))
          existing.push(...polygon);
      }
    }
  })(DATA);
  items = items.filter((item) => !existingPaths.has(item.path));
  for (const item of items) console.log(`  ${REDO.has(item.path) ? "redone" : "new"}: ${item.path}`);

  existingVertices = new Set();
  existingEdges = new Set();
  for (const ring of existing) {
    for (let i = 0; i + 1 < ring.length; i++) {
      const [a, b] = [key(ring[i]!), key(ring[i + 1]!)];
      existingVertices.add(a);
      existingEdges.add(`${a}|${b}`).add(`${b}|${a}`);
    }
  }
  let snapped = 0;
  for (const item of items) {
    const g = item.feature.geometry;
    const before = JSON.stringify(g).length;
    if (g.type === "Polygon") g.coordinates = g.coordinates.map(snapToExisting);
    else g.coordinates = g.coordinates.map((p: Position[][]) => p.map(snapToExisting));
    if (JSON.stringify(g).length !== before) snapped++;
  }
  if (snapped) console.log(`  ${snapped} new boundaries snapped to existing borders`);

  sharers = new Map();
  items.forEach((item, id) => {
    for (const polygon of boundaryPolygons({ type: "FeatureCollection", features: [item.feature] })) {
      for (const ring of polygon) {
        for (const p of ring) {
          const k = key(p);
          const list = sharers.get(k);
          if (!list) sharers.set(k, [id]);
          else if (list[list.length - 1] !== id) list.push(id);
        }
      }
    }
  });

  const tolerances = items.map(() => BASE_TOLERANCE);
  let texts: string[] = [];
  for (;;) {
    texts = items.map((item) => simplify(item.feature, tolerances));
    const large = items.map((_, i) => i).filter((i) => texts[i]!.length > MAX_BYTES);
    const reducible = large.filter((i) => tolerances[i]! < MAX_TOLERANCE);
    if (!reducible.length) {
      for (const i of large) console.log(`  too large, simplify it in /edit-map: ${items[i]!.path} (${Math.round(texts[i]!.length / 1024)} KB)`);
      break;
    }
    for (const i of reducible) tolerances[i] = Math.min(tolerances[i]! * 1.3, MAX_TOLERANCE);
  }
  const total = texts.reduce((s, t) => s + t.length, 0);
  console.log(`  ${DRY ? "would add" : "added"} ${items.length} files to data/, total ${Math.round(total / 1024)} KB`);

  if (DRY) return;
  for (const [i, item] of items.entries()) {
    const file = `${DATA}/${item.path}.geojson`;
    // Never overwrite, but the files of --redo
    const redone = REDO.delete(item.path);
    if (!redone && existsSync(file)) throw new Error(`${file} exists`);
    mkdirSync(file.slice(0, file.lastIndexOf("/")), { recursive: true });
    writeFileSync(file, texts[i]!, { flag: redone ? "w" : "wx" });
  }
  for (const region of built) imported.add(region.code);
  saveImported();
}

// --- Audit --------------------------------------------------------------------------------------

function segmentDistance(p: Position, a: Position, b: Position) {
  return Math.sqrt(segmentDistanceSq(p, a, b));
}

function ringArea(ring: Position[]) {
  let area = 0;
  for (let i = 0; i + 1 < ring.length; i++) area += ring[i]![0]! * ring[i + 1]![1]! - ring[i + 1]![0]! * ring[i]![1]!;
  return Math.abs(area) / 2;
}

/** In square degrees: only to compare two versions of a boundary */
const featureArea = (feature: any) =>
  boundaryPolygons({ type: "FeatureCollection", features: [feature] }).reduce(
    (sum, [outer, ...holes]) => sum + ringArea(outer!) - holes.reduce((h, ring) => h + ringArea(ring), 0),
    0,
  );

/**
 * Lists the files of data/ far from their boundary in raw/: the largest distance of (a sample of)
 * the OSM vertices to the file, and the ratio of their areas. A coast simplified in the editor is
 * far, but has about the same area; a broken file (a part missing...) does not.
 */
function audit() {
  const files = new Map<string, { path: string; feature: any }>();
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${dir}/${e.name}`);
      else if (e.name.endsWith(".geojson")) {
        const feature = JSON.parse(readFileSync(`${dir}/${e.name}`, "utf8")).features[0];
        const path = `${dir}/${e.name}`.slice(DATA.length + 1, -".geojson".length);
        if (feature?.properties?.id) files.set(feature.properties.id, { path, feature });
      }
    }
  })(DATA);
  const far: { path: string; distance: number; area: number; file: Position[][][]; osm: Position[][][] }[] = [];
  let compared = 0;
  for (const region of REGIONS) {
    if (!existsSync(rawFile(region))) continue;
    for (const raw of rawFeatures(region).features) {
      const file = files.get(raw.properties.id);
      if (!file) continue;
      files.delete(raw.properties.id);
      compared++;
      const segments: [Position, Position][] = [];
      for (const polygon of boundaryPolygons({ type: "FeatureCollection", features: [file.feature] }))
        for (const ring of polygon) for (let i = 0; i + 1 < ring.length; i++) segments.push([ring[i]!, ring[i + 1]!]);
      const vertices: Position[] = [];
      for (const polygon of boundaryPolygons({ type: "FeatureCollection", features: [raw] }))
        for (const ring of polygon) vertices.push(...ring);
      const step = Math.max(1, Math.floor(vertices.length / 400));
      let distance = 0;
      for (let i = 0; i < vertices.length; i += step) {
        let nearest = Infinity;
        for (const [a, b] of segments) nearest = Math.min(nearest, segmentDistance(vertices[i]!, a, b));
        distance = Math.max(distance, nearest);
      }
      if (distance > AUDIT_THRESHOLD)
        far.push({
          path: file.path,
          distance,
          area: featureArea(file.feature) / featureArea(raw),
          file: preview(file.feature),
          osm: preview(raw),
        });
    }
  }
  far.sort((a, b) => b.distance - a.distance);
  console.log("  distance  area  file");
  for (const { path, distance, area } of far)
    console.log(`  ${distance.toFixed(3).padStart(7)}° ${`${Math.round(area * 100)}%`.padStart(5)}  ${path}`);
  writeFileSync(`${import.meta.dirname}/audit.json`, JSON.stringify(far));
  console.log(`${far.length} of ${compared} files are more than ${AUDIT_THRESHOLD}° from their OSM boundary (${files.size} files without OSM id or not in raw/)`);
  console.log("Compared in import/audit.json. Import the ones to replace again with: bun run import -- --redo <path>...");
}

/** The polygons of the feature, light enough to be drawn side by side in a page */
function preview(feature: any): Position[][][] {
  const tolerance = 0.005;
  return boundaryPolygons({ type: "FeatureCollection", features: [feature] }).map((polygon) =>
    polygon.map((ring) => {
      const keep = new Uint8Array(ring.length);
      keep[0] = keep[ring.length - 1] = 1;
      douglasPeucker(ring, 0, ring.length - 1, tolerance * tolerance, keep);
      return ring.filter((_, i) => keep[i]).map(([x, y]) => [Math.round(x! * 1e3) / 1e3, Math.round(y! * 1e3) / 1e3]);
    }),
  );
}

/** Replaces the parts of the ring that follow an edge of an existing file by that edge */
function snapToExisting(ring: Position[]): Position[] {
  const n = ring.length - 1;
  const anchors: number[] = [];
  for (let i = 0; i < n; i++) if (existingVertices.has(key(ring[i]!))) anchors.push(i);
  if (anchors.length < 2) return ring;
  const drop = new Uint8Array(n);
  for (let a = 0; a < anchors.length; a++) {
    const i = anchors[a]!;
    const j = anchors[(a + 1) % anchors.length]!;
    if (!existingEdges.has(`${key(ring[i]!)}|${key(ring[j]!)}`)) continue;
    for (let k = (i + 1) % n; k !== j; k = (k + 1) % n) drop[k] = 1;
  }
  const result = ring.slice(0, n).filter((_, i) => !drop[i]);
  result.push(result[0]!);
  return result;
}

// --- Simplification -----------------------------------------------------------------------------

function segmentDistanceSq(p: Position, a: Position, b: Position) {
  let x = a[0]!, y = a[1]!;
  let dx = b[0]! - x, dy = b[1]! - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0]! - x) * dx + (p[1]! - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = b[0]!; y = b[1]!; }
    else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = p[0]! - x; dy = p[1]! - y;
  return dx * dx + dy * dy;
}

function douglasPeucker(points: Position[], first: number, last: number, toleranceSq: number, keep: Uint8Array) {
  const stack: [number, number][] = [[first, last]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let max = 0, index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = segmentDistanceSq(points[i]!, points[start]!, points[end]!);
      if (d > max) { max = d; index = i; }
    }
    if (index !== -1 && max > toleranceSq) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
}

/** Same as simplifyRing of the editor, with a tolerance per segment between two fixed vertices */
function simplifyRing(ring: Position[], tolerances: number[]): Position[] | undefined {
  const n = ring.length - 1;
  if (n < 3) return;
  const keys = ring.map(sharersKey);
  const fixed: number[] = [];
  for (let i = 0; i < n; i++) {
    const prev = keys[(i - 1 + n) % n], next = keys[(i + 1) % n];
    if (locked(ring[i]!) || keys[i] !== prev || keys[i] !== next) fixed.push(i);
  }
  if (fixed.length === 0) {
    let far = 0, farDistance = -1;
    for (let i = 1; i < n; i++) {
      const d = (ring[i]![0]! - ring[0]![0]!) ** 2 + (ring[i]![1]! - ring[0]![1]!) ** 2;
      if (d > farDistance) { farDistance = d; far = i; }
    }
    fixed.push(0, far);
  }
  const start = fixed[0]!;
  const unrolled: Position[] = [];
  for (let i = 0; i <= n; i++) unrolled.push(ring[(start + i) % n]!);
  const keep = new Uint8Array(n + 1);
  const anchors = [...fixed.map((i) => i - start), n];
  for (const a of anchors) keep[a] = 1;
  for (let i = 0; i + 1 < anchors.length; i++) {
    const [a, b] = [anchors[i]!, anchors[i + 1]!];
    if (b - a < 2) continue;
    // The vertices between two fixed vertices are all used by the same boundaries
    const tolerance = Math.max(...sharers.get(key(unrolled[a + 1]!))!.map((id) => tolerances[id]!));
    douglasPeucker(unrolled, a, b, tolerance * tolerance, keep);
  }
  const result = unrolled.filter((_, i) => keep[i]);
  return result.length < 4 ? undefined : result;
}

function simplify(feature: any, tolerances: number[]) {
  const rings = (rings: Position[][]) => {
    const result: Position[][] = [];
    for (const [r, ring] of rings.entries()) {
      const s = simplifyRing(ring, tolerances);
      if (s) result.push(s);
      else if (r === 0) return;
    }
    return result;
  };
  const g = feature.geometry;
  let coordinates;
  if (g.type === "Polygon") coordinates = rings(g.coordinates) ?? g.coordinates;
  else {
    const polygons = g.coordinates.map(rings).filter((p: any) => !!p);
    coordinates = polygons.length ? polygons : g.coordinates;
  }
  return JSON.stringify({
    type: "FeatureCollection",
    features: [{ ...feature, geometry: { type: g.type, coordinates } }],
  });
}


// --- Main ---------------------------------------------------------------------------------------

// What raw/ already has (an interrupted run, --redo) is built first
if (!AUDIT) build();
await download();
if (AUDIT) audit();
else if (REDO.size && !DRY) console.log(`Not redone (no OSM relation in raw/): ${[...REDO].join(" ")}`);
console.log("DONE");
