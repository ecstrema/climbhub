import sqlite3InitModule, { type Database } from "@sqlite.org/sqlite-wasm";
import type { DataJSON } from "@climbhub/climbing-data-gen";
import { featureToType, getName } from "#lib/data/parse/data.js";
import { getParentSlug } from "#lib/helpers/slug.js";
import { getGrade, getGradeReference } from "#lib/data/parse/osm-tags.js";
import { getColorFromGrade } from "#lib/data/network/grade.js";
import {
  buildSectorContour,
  extractRouteStyle,
  FEATURE_COLORS,
  ROUTE_STYLE_COLORS,
} from "#lib/data/parse/route-styles.js";
import type { DbRequest, DbResponse, MapElementFeature, SearchFilters } from "./types";

/** Bump when the tables change: the database is then downloaded again */
const SCHEMA = 2;

let dbPromise: Promise<{ db: Database; persistent: boolean }> | undefined;

function openDb() {
  dbPromise ??= (async () => {
    const sqlite3 = await sqlite3InitModule();
    let db: Database;
    let persistent = false;
    try {
      const pool = await sqlite3.installOpfsSAHPoolVfs({ name: "climbhub" });
      db = new pool.OpfsSAHPoolDb("/climbhub.sqlite3");
      persistent = true;
    } catch {
      db = new sqlite3.oo1.DB(":memory:");
    }
    db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)");
    return { db, persistent };
  })();
  return dbPromise;
}

function createSchema(db: Database) {
  db.exec(`
    DROP TABLE IF EXISTS elements;
    DROP TABLE IF EXISTS stats;
    DROP TABLE IF EXISTS places;
    CREATE TABLE elements (
      slug TEXT PRIMARY KEY, parent_slug TEXT NOT NULL, data TEXT NOT NULL, type TEXT NOT NULL, grade_ref REAL
    );
    CREATE INDEX elements_parent ON elements (parent_slug);
    CREATE TABLE stats (slug TEXT PRIMARY KEY, total_routes INTEGER NOT NULL);
    CREATE VIRTUAL TABLE places USING fts5(
      name, slug UNINDEXED,
      tokenize = 'unicode61 remove_diacritics 2', prefix = '2 3'
    );
  `);
}

function getMeta(db: Database, key: string): string | undefined {
  return db.selectValue("SELECT value FROM meta WHERE key = ?", [key]) as string | undefined;
}

async function buildDatabase(url: string, version: string, id: number) {
  const { db } = await openDb();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const length = Number(res.headers.get("content-length"));
  const total = length > 0 ? length : undefined;
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  const reader = res.body!.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    self.postMessage({ id, type: "progress", loaded, total } satisfies DbResponse);
  }
  const records: Record<string, DataJSON> = JSON.parse(await new Blob(chunks as BlobPart[]).text());

  // Deepest first, so that a node's total is complete before it is added to its parent
  const slugs = Object.keys(records).sort((a, b) => b.split("/").length - a.split("/").length);
  const totals = new Map<string, number>();
  for (const slug of slugs) {
    const parent = getParentSlug(slug);
    if (parent === undefined) continue;
    const isRoute = featureToType(records[slug]!) === "route";
    totals.set(parent, (totals.get(parent) ?? 0) + (isRoute ? 1 : (totals.get(slug) ?? 0)));
  }

  db.transaction(() => {
    createSchema(db);
    db.exec("DELETE FROM meta;");
    const insertElement = db.prepare(
      "INSERT INTO elements (slug, parent_slug, data, type, grade_ref) VALUES (?, ?, ?, ?, ?)",
    );
    const insertPlace = db.prepare("INSERT INTO places (name, slug) VALUES (?, ?)");
    const insertStats = db.prepare("INSERT INTO stats (slug, total_routes) VALUES (?, ?)");
    try {
      for (const [slug, feature] of Object.entries(records)) {
        const gradeRef = feature.type === "geographic" ? undefined : getGradeReference(feature.tags ?? {});
        insertElement
          .bind([
            slug,
            getParentSlug(slug) ?? "",
            JSON.stringify(feature),
            featureToType(feature) ?? "other",
            gradeRef ?? null,
          ])
          .stepReset();
        const name = getName(feature);
        if (name) insertPlace.bind([name, slug]).stepReset();
      }
      for (const [slug, total] of totals) insertStats.bind([slug, total]).stepReset();
    } finally {
      insertElement.finalize();
      insertPlace.finalize();
      insertStats.finalize();
    }
    db.exec({ sql: "INSERT INTO meta (key, value) VALUES ('version', ?)", bind: [`${version}:${SCHEMA}`] });
  });
}

function toMatchQuery(query: string): string | undefined {
  const tokens = query.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (tokens.length === 0) return;
  return tokens.map((t) => `"${t}"*`).join(" ");
}

function tagPath(key: string): string {
  return `$.tags."${key.replaceAll('"', "")}"`;
}

function buildFilterQuery(filters: SearchFilters): { sql: string; bind: (string | number)[] } | undefined {
  const where: string[] = [];
  const bind: (string | number)[] = [];

  const match = toMatchQuery(filters.text);
  if (match) {
    where.push("slug IN (SELECT slug FROM places WHERE places MATCH ?)");
    bind.push(match);
  }
  if (filters.types.length > 0) {
    where.push(`type IN (${filters.types.map(() => "?").join(", ")})`);
    bind.push(...filters.types);
  }
  if (filters.gradeMin !== undefined) {
    where.push("grade_ref >= ?");
    bind.push(filters.gradeMin);
  }
  if (filters.gradeMax !== undefined) {
    where.push("grade_ref <= ?");
    bind.push(filters.gradeMax);
  }
  if (filters.styles.length > 0) {
    // A route graded in a style's own scale (e.g. climbing:grade:ice) belongs to that style
    where.push(
      `(${filters.styles
        .map(
          () =>
            "(json_extract(data, ?) = 'yes' OR CAST(json_extract(data, ?) AS REAL) > 0 OR json_extract(data, ?) IS NOT NULL)",
        )
        .join(" OR ")})`,
    );
    bind.push(
      ...filters.styles.flatMap((style) => [
        tagPath(`climbing:${style}`),
        tagPath(`climbing:${style}`),
        tagPath(`climbing:grade:${style}`),
      ]),
    );
  }
  for (const { key, value } of filters.tags) {
    if (value) {
      where.push("json_extract(data, ?) = ?");
      bind.push(tagPath(key), value);
    } else {
      where.push("json_extract(data, ?) IS NOT NULL");
      bind.push(tagPath(key));
    }
  }
  if (where.length === 0) return;
  return { sql: `SELECT slug FROM elements WHERE ${where.join(" AND ")}`, bind };
}

interface Search {
  stmt: ReturnType<Database["prepare"]>;
  running: boolean;
  cancelled: boolean;
}
const searches = new Map<number, Search>();

function endSearch(searchId: number) {
  searches.get(searchId)?.stmt.finalize();
  searches.delete(searchId);
}

const BATCH_SIZE = 200;

/** Streams matches until the time budget is spent. Returns true when there are no more rows. */
async function runSearch(searchId: number, search: Search, budgetMs: number): Promise<boolean> {
  const deadline = performance.now() + budgetMs;
  search.running = true;
  try {
    for (;;) {
      const slugs: string[] = [];
      let finished = false;
      while (slugs.length < BATCH_SIZE) {
        if (!search.stmt.step()) {
          finished = true;
          break;
        }
        slugs.push(search.stmt.get(0) as string);
      }
      if (slugs.length > 0) self.postMessage({ type: "matchBatch", searchId, slugs } satisfies DbResponse);
      if (finished) {
        endSearch(searchId);
        return true;
      }
      if (performance.now() > deadline) return false;
      // Lets cancellations and other requests run between batches
      await new Promise((resolve) => setTimeout(resolve));
      if (search.cancelled) {
        endSearch(searchId);
        return true;
      }
    }
  } finally {
    search.running = false;
  }
}

async function handle(req: DbRequest): Promise<DbResponse> {
  const { db, persistent } = await openDb();
  switch (req.type) {
    case "status":
      return { id: req.id, type: "status", ready: getMeta(db, "version") === `${req.version}:${SCHEMA}`, persistent };
    case "build":
      await buildDatabase(req.url, req.version, req.id);
      return { id: req.id, type: "status", ready: true, persistent };
    case "getNode": {
      const data = db.selectValue("SELECT data FROM elements WHERE slug = ?", [req.slug]) as string | undefined;
      return { id: req.id, type: "node", data: data === undefined ? undefined : JSON.parse(data) };
    }
    case "getChildren": {
      const rows = db.selectArrays("SELECT slug, data FROM elements WHERE parent_slug = ?", [req.slug]);
      const data = Object.fromEntries(rows.map(([slug, json]) => [slug as string, JSON.parse(json as string)]));
      return { id: req.id, type: "children", data };
    }
    case "getTopLevel": {
      // Places directly under a geographic folder, with their coordinates (center for ways and relations)
      const rows = db.selectArrays(`
        SELECT slug, json_extract(data, '$.tags.name'),
          COALESCE(json_extract(data, '$.lat'), json_extract(data, '$.center.lat')),
          COALESCE(json_extract(data, '$.lon'), json_extract(data, '$.center.lon'))
        FROM elements
        WHERE type != 'geographic' AND parent_slug IN (SELECT slug FROM elements WHERE type = 'geographic')
      `);
      const data = rows.flatMap(([slug, name, lat, lon]) =>
        typeof lat === "number" && typeof lon === "number"
          ? [{ slug: slug as string, name: (name as string | null) ?? undefined, lat, lon }]
          : [],
      );
      return { id: req.id, type: "topLevel", data };
    }
    case "getAllMapElements": {
      const rows = db.selectArrays(`
        SELECT slug, type, parent_slug, data
        FROM elements
        WHERE type != 'geographic' AND (json_extract(data, '$.lat') IS NOT NULL OR json_extract(data, '$.center.lat') IS NOT NULL)
      `);

      const parsedItems: {
        slug: string;
        type: string;
        parentSlug: string;
        lat: number;
        lon: number;
        item: any;
      }[] = [];
      const nodeCoords = new Map<number, [number, number]>();
      const sectorRoutes = new Map<string, [number, number][]>();

      for (const [slug, type, parentSlug, dataJson] of rows) {
        const item = JSON.parse(dataJson as string);
        const lat = item.lat ?? item.center?.lat;
        const lon = item.lon ?? item.center?.lon;
        if (typeof lat !== "number" || typeof lon !== "number") continue;

        if (item.type === "node") {
          nodeCoords.set(item.id, [lon, lat]);
        }

        const isRoute = (type as string) === "route";
        if (isRoute && parentSlug) {
          if (!sectorRoutes.has(parentSlug as string)) {
            sectorRoutes.set(parentSlug as string, []);
          }
          sectorRoutes.get(parentSlug as string)!.push([lon, lat]);
        }

        parsedItems.push({
          slug: slug as string,
          type: type as string,
          parentSlug: parentSlug as string,
          lat,
          lon,
          item,
        });
      }

      const features: MapElementFeature[] = [];

      for (const { slug, type, lat, lon, item } of parsedItems) {
        const tags = item.tags ?? {};
        const isCliff = tags.natural === "cliff";

        if (isCliff) {
          // Cliffs should be paths made out of their nodes, not circles
          let coords: [number, number][] = [];
          if (item.type === "way" && Array.isArray(item.nodes)) {
            coords = item.nodes.map((id: number) => nodeCoords.get(id)).filter(Boolean) as [number, number][];
          }
          if (coords.length < 2) {
            // Short line segment path through node/center
            coords = [
              [lon - 0.00015, lat],
              [lon + 0.00015, lat],
            ];
          }
          features.push({
            type: "Feature",
            geometry: { type: "LineString", coordinates: coords },
            properties: {
              slug,
              name: tags.name ?? "Cliff",
              elementType: "cliff",
              fillColor: "transparent",
              strokeColor: FEATURE_COLORS.cliff.fill,
              href: "",
            },
          });
          continue;
        }

        if (type === "route") {
          const routeStyle = extractRouteStyle(tags);
          const strokeColor = ROUTE_STYLE_COLORS[routeStyle] ?? "#64748b";
          let fillColor = "#94a3b8";
          let gradeStr: string | undefined;
          const gradeObj = getGrade(tags)?.v;
          if (gradeObj) {
            gradeStr = gradeObj.v;
            if (gradeObj.scale !== "unknown") {
              fillColor = getColorFromGrade(gradeObj.v, gradeObj.scale);
            }
          }
          features.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [lon, lat] },
            properties: {
              slug,
              name: tags.name ?? "Unnamed",
              elementType: "route",
              routeStyle,
              grade: gradeStr,
              fillColor,
              strokeColor,
              href: "",
            },
          });
          continue;
        }

        if (type === "area") {
          const routes = sectorRoutes.get(slug);
          if (routes && routes.length > 0) {
            // Sector with routes: show as contour around its routes, not as center point
            const contour = buildSectorContour(routes);
            if (contour.length >= 3) {
              features.push({
                type: "Feature",
                geometry: { type: "LineString", coordinates: contour },
                properties: {
                  slug,
                  name: tags.name ?? "Sector",
                  elementType: "sector",
                  fillColor: "transparent",
                  strokeColor: "#64748b",
                  href: "",
                },
              });
              continue;
            }
          }
          // Area without child routes: show as general area point
          features.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [lon, lat] },
            properties: {
              slug,
              name: tags.name ?? "Unnamed",
              elementType: "area",
              fillColor: FEATURE_COLORS.area.fill,
              strokeColor: FEATURE_COLORS.area.stroke,
              href: "",
            },
          });
          continue;
        }

        if (type === "gym") {
          features.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [lon, lat] },
            properties: {
              slug,
              name: tags.name ?? "Unnamed",
              elementType: "gym",
              fillColor: FEATURE_COLORS.gym.fill,
              strokeColor: FEATURE_COLORS.gym.stroke,
              href: "",
            },
          });
        }
      }

      return { id: req.id, type: "allMapElements", data: { type: "FeatureCollection", features } };
    }
    case "getStats": {
      const total = db.selectValue("SELECT total_routes FROM stats WHERE slug = ?", [req.slug]) as number | undefined;
      return { id: req.id, type: "stats", data: { totalRoutes: total ?? 0 } };
    }
    case "filterStart": {
      const query = buildFilterQuery(req.filters);
      if (!query) return { id: req.id, type: "matchPause", exhausted: true };
      const stmt = db.prepare(query.sql);
      stmt.bind(query.bind);
      const search: Search = { stmt, running: false, cancelled: false };
      searches.set(req.searchId, search);
      return { id: req.id, type: "matchPause", exhausted: await runSearch(req.searchId, search, req.budgetMs) };
    }
    case "filterMore": {
      const search = searches.get(req.searchId);
      if (!search) return { id: req.id, type: "matchPause", exhausted: true };
      return { id: req.id, type: "matchPause", exhausted: await runSearch(req.searchId, search, req.budgetMs) };
    }
    case "filterCancel": {
      const search = searches.get(req.searchId);
      if (search) {
        search.cancelled = true;
        if (!search.running) endSearch(req.searchId);
      }
      return { id: req.id, type: "matchPause", exhausted: true };
    }
  }
}

self.onmessage = async (event: MessageEvent<DbRequest>) => {
  try {
    self.postMessage(await handle(event.data));
  } catch (err) {
    self.postMessage({ id: event.data.id, type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
