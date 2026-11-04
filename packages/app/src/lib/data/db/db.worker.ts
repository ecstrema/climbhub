import sqlite3InitModule, { type Database } from "@sqlite.org/sqlite-wasm";
import type { DataJSON } from "@climbhub/climbing-data-gen";
import { featureToType, getName } from "#lib/data/parse/data.js";
import { getParentSlug } from "#lib/helpers/slug.js";
import { getGradeReference } from "#lib/data/parse/osm-tags.js";
import type { DbRequest, DbResponse, SearchFilters } from "./types";

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
    where.push(`(${filters.styles.map(() => "json_extract(data, ?) = 'yes'").join(" OR ")})`);
    bind.push(...filters.styles.map((style) => tagPath(`climbing:${style}`)));
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
