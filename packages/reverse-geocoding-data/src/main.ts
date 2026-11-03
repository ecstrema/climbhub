import { readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { join } from "path";

import type { BoundingBox, IndexNode } from "./types.ts";
import { DATA_DIR, HIERARCHY_INDEX, OUTPUT_DIR } from "./config.ts";
import { BOUNDARY_EXTENSION, LARGE_BOUNDARY_BYTES, slugify } from "./shared.ts";
import { ensureDirExists } from "./utils.ts";

let errors = 0;
function error(message: string) {
  console.error(`❌ ${message}`);
  errors++;
}

function mergeBbox(b1: BoundingBox, b2: BoundingBox): BoundingBox {
  return {
    x0: Math.min(b1.x0, b2.x0),
    x1: Math.max(b1.x1, b2.x1),
    y0: Math.min(b1.y0, b2.y0),
    y1: Math.max(b1.y1, b2.y1),
  };
}

function initBbox(): BoundingBox {
  return { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
}

function calculateGeoJsonBbox(geojson: any): BoundingBox {
  let bbox = initBbox();
  function processCoordinates(coords: any) {
    if (typeof coords[0] === "number") {
      const [lon, lat] = coords;
      bbox = mergeBbox(bbox, { x0: lon, x1: lon, y0: lat, y1: lat });
    } else {
      for (const sub of coords) {
        processCoordinates(sub);
      }
    }
  }
  for (const feature of geojson.features) {
    if (feature.geometry?.coordinates) processCoordinates(feature.geometry.coordinates);
  }
  return bbox;
}

function readLeaf(file: string, relativePath: string): IndexNode {
  const size = statSync(file).size;
  if (size > LARGE_BOUNDARY_BYTES) {
    console.warn(
      `⚠️  ${relativePath} is ${Math.round(size / 1024)} KB (> ${LARGE_BOUNDARY_BYTES / 1024} KB): consider simplifying it in /edit-map.`,
    );
  }

  let geojson: any;
  try {
    geojson = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    error(`${relativePath} is not valid JSON: ${e}`);
    return { _bbox: initBbox() };
  }
  if (geojson?.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
    error(`${relativePath} must be a FeatureCollection`);
    return { _bbox: initBbox() };
  }
  const polygons = geojson.features.filter(
    (f: any) => f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon",
  );
  if (!polygons.length) error(`${relativePath} has no Polygon or MultiPolygon`);
  return { _bbox: calculateGeoJsonBbox(geojson) };
}

/**
 * Builds the index of a directory of data/. Children are sorted by slug: the geolocation tries
 * them in this order, so the first matching sibling wins.
 */
function buildHierarchyTree(dir: string, relativePath: string): IndexNode {
  const self: IndexNode = { _bbox: initBbox() };

  const entries = readdirSync(dir, { withFileTypes: true }).filter((e) => !e.name.startsWith("."));
  const children = new Map<string, IndexNode>();
  for (const entry of entries) {
    const path = join(dir, entry.name);
    const childRelativePath = `${relativePath}/${entry.name}`;
    let slug: string;
    let child: IndexNode;
    if (entry.isDirectory()) {
      slug = entry.name;
      child = buildHierarchyTree(path, childRelativePath);
      if (Object.keys(child).length === 1) error(`${childRelativePath}/ has no region`);
    } else if (entry.isFile() && entry.name.endsWith(BOUNDARY_EXTENSION)) {
      slug = entry.name.slice(0, -BOUNDARY_EXTENSION.length);
      child = readLeaf(path, childRelativePath);
    } else {
      error(`Unexpected file ${childRelativePath}: data/ only contains directories and *${BOUNDARY_EXTENSION}`);
      continue;
    }

    if (slug !== slugify(slug)) error(`${childRelativePath} is not a slug (expected ${slugify(slug)})`);
    if (children.has(slug)) {
      error(
        `${relativePath}/${slug} is both a directory and a ${BOUNDARY_EXTENSION} file: only leaves have a boundary`,
      );
      continue;
    }
    children.set(slug, child);
  }

  for (const slug of [...children.keys()].sort()) {
    const child = children.get(slug)!;
    self._bbox = mergeBbox(self._bbox, child._bbox);
    self[slug] = child;
  }
  return self;
}

function main() {
  ensureDirExists(OUTPUT_DIR);

  const worldTree = buildHierarchyTree(join(DATA_DIR, "world"), "world");
  if (errors) {
    console.error(`\n${errors} error(s) in ${DATA_DIR}`);
    process.exit(1);
  }

  writeFileSync(HIERARCHY_INDEX, JSON.stringify({ world: worldTree }));
  console.log(`🎯 Spatial Index written successfully -> ${HIERARCHY_INDEX}`);
}

main();
