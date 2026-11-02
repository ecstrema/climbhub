import { existsSync } from "fs";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { postOverpass, type WorldClimbingPoints } from "./world.ts";

const WORLD_CLIMBING_DATA_QUERY = `
[out:json][timeout:600];
nwr["sport"="climbing"];
out center meta;`;
const GLOBAL_RETRIES = 10;
const GLOBAL_RETRY_DELAY = 60_000;

const sleepBeforeGlobalRetry = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Downloads and caches one worldwide Overpass result instead of splitting it into tiles. */
export async function downloadClimbingData(
  outputFilePath: string,
  { force = false } = {},
): Promise<string> {
  if (!force && existsSync(outputFilePath)) {
    const cached = JSON.parse(await readFile(outputFilePath, "utf8"));
    if (Array.isArray(cached.elements)) {
      console.log(`Using cached worldwide climbing data from ${outputFilePath}`);
      return outputFilePath;
    }
    throw new Error(`Invalid climbing data cache: ${outputFilePath}`);
  }

  console.log("Downloading worldwide climbing data in one Overpass query...");
  let data: any;
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await postOverpass(WORLD_CLIMBING_DATA_QUERY, (result) => {
        if (result.remark) {
          throw new Error(`Overpass returned incomplete climbing data: ${result.remark}`);
        }
      });
      data = JSON.parse(response);
      break;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (attempt >= GLOBAL_RETRIES)
        throw new Error(`Failed to download worldwide climbing data: ${message}`);
      console.warn(
        `Overpass failed (${message.slice(0, 300)}), retrying in ${GLOBAL_RETRY_DELAY / 1000} s (${GLOBAL_RETRIES - attempt} tries left)`,
      );
      await sleepBeforeGlobalRetry(GLOBAL_RETRY_DELAY);
    }
  }

  await mkdir(dirname(outputFilePath), { recursive: true });
  const temporaryPath = `${outputFilePath}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(data));
  await rename(temporaryPath, outputFilePath);
  console.log(`Saved ${data.elements.length} elements to ${outputFilePath}`);
  return outputFilePath;
}

/**
 * The climbing data of the whole world is too large for a single Overpass query, so the world is
 * split into tiles with a quadtree: the key of a tile is `q` followed by the index (0 to 3) of the
 * quadrant at each level. Each tile is downloaded with its own query, and cached in its own file,
 * so an interrupted download resumes with the missing tiles only.
 *
 * Overpass etiquette: requests are strictly sequential, never in parallel, with at least
 * DELAY_BETWEEN_REQUESTS between two of them, retries included.
 */

/** Tiles with more climbing places than this are split before being downloaded */
const MAX_PLACES_PER_TILE = 1000;
/** Depth of the tiles when the world climbing places are unknown (45° × 22.5° tiles) */
const DEFAULT_DEPTH = 3;
/** Tiles that still fail at this depth (about 0.35° × 0.18°) are not split anymore */
const MAX_DEPTH = 10;
/** Overpass rejects the queries that declare a large timeout */
const QUERY_TIMEOUT = 180;

/** Minimum pause between two Overpass requests, whatever their result */
const DELAY_BETWEEN_REQUESTS = 30_000;
/** Extra wait after a failure, doubled on each retry */
const RETRY_DELAY = 60_000;
const MAX_RETRY_DELAY = 10 * 60_000;
const RETRIES = 10;

const PLAN_FILE = "plan.json";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** List of the tiles to download. It is saved so that a resumed download uses the same tiles. */
interface Plan {
  tiles: string[];
}

function getTileBBox(key: string): BBox {
  const bbox = { west: -180, south: -90, east: 180, north: 90 };
  for (const quadrant of key.slice(1)) {
    const lon = (bbox.west + bbox.east) / 2;
    const lat = (bbox.south + bbox.north) / 2;
    if (quadrant === "0" || quadrant === "2") bbox.east = lon;
    else bbox.west = lon;
    if (quadrant === "0" || quadrant === "1") bbox.north = lat;
    else bbox.south = lat;
  }
  return bbox;
}

const getChildren = (key: string) => ["0", "1", "2", "3"].map((quadrant) => key + quadrant);

const getDepth = (key: string) => key.length - 1;

function getTileFile(dir: string, key: string) {
  return join(dir, `${key}.json`);
}

function getQuery({ west, south, east, north }: BBox) {
  return `
[out:json][timeout:${QUERY_TIMEOUT}];
// Find all nodes, ways, and relations explicitly tagged with sport=climbing in the tile. Only this
// statement is restricted to the tile: their parents and children are complete.
nwr["sport"="climbing"](${south},${west},${north},${east});

// Union block: Get parent elements of routes and ways (this catches 'type=site' relations
// that group the climbing routes but lack the sport tag themselves)
(._; <;);

// Get parent relations of relations:
(._; <<;);

// Union block: take the current results and recursively get all their children
(._; >;);

// Output with metadata AND natively attached geometries
out geom meta;`;
}

/**
 * Splits the world into tiles of at most MAX_PLACES_PER_TILE climbing places, using the world
 * climbing places of the boundary editor when they are cached.
 */
async function createPlan(worldPointsFile: string): Promise<Plan> {
  if (!existsSync(worldPointsFile)) {
    console.warn(
      `${worldPointsFile} does not exist: the world is split into tiles of depth ${DEFAULT_DEPTH}, and the tiles that fail are split further.`,
    );
    const tiles = ["q"];
    while (getDepth(tiles[0]!) < DEFAULT_DEPTH) tiles.push(...getChildren(tiles.shift()!));
    return { tiles };
  }

  const { points }: WorldClimbingPoints = JSON.parse(await readFile(worldPointsFile, "utf8"));
  const tiles: string[] = [];
  const split = (key: string, places: { lon: number; lat: number }[]) => {
    if (places.length <= MAX_PLACES_PER_TILE || getDepth(key) >= MAX_DEPTH) {
      tiles.push(key);
      return;
    }
    for (const child of getChildren(key)) {
      const { west, south, east, north } = getTileBBox(child);
      split(
        child,
        places.filter((p) => p.lon >= west && p.lon < east && p.lat >= south && p.lat < north),
      );
    }
  };
  split("q", points);
  return { tiles };
}

async function writeFileAtomically(path: string, content: string) {
  await writeFile(`${path}.tmp`, content);
  await rename(`${path}.tmp`, path);
}

class TileTooLargeError extends Error {}

/** Waits so that two Overpass requests are always at least DELAY_BETWEEN_REQUESTS apart */
let lastRequestEnd = 0;
async function throttledPostOverpass(query: string): Promise<string> {
  const wait = lastRequestEnd + DELAY_BETWEEN_REQUESTS - Date.now();
  if (wait > 0) await sleep(wait);
  try {
    return await postOverpass(query);
  } finally {
    lastRequestEnd = Date.now();
  }
}

/**
 * Downloads one tile, and returns the raw Overpass response. Throws TileTooLargeError when
 * Overpass cannot process the tile (timeout or out of memory), so that it is split.
 */
async function downloadTile(key: string): Promise<string> {
  const query = getQuery(getTileBBox(key));
  for (let attempt = 0; ; attempt++) {
    let error: string;
    try {
      const body = await throttledPostOverpass(query);
      // Overpass answers 200 with a partial result and a remark when the query fails while running
      const { remark } = JSON.parse(body);
      if (!remark?.includes("runtime error")) return body;
      if (/timed out|out of memory/i.test(remark)) throw new TileTooLargeError(remark);
      error = remark;
    } catch (e) {
      if (e instanceof TileTooLargeError) throw e;
      // Network errors (connection refused or reset), HTTP errors (429: too many requests, 504:
      // server busy) and truncated responses are retried later
      error = e instanceof Error ? e.message : String(e);
      // The query is generated, a bad request will not get better
      if (error.startsWith("400 ")) throw new Error(`Overpass rejected the query: ${error}`);
    }
    if (attempt >= RETRIES) throw new Error(`Failed to download the tile ${key}: ${error}`);
    const delay = Math.min(RETRY_DELAY * 2 ** attempt, MAX_RETRY_DELAY);
    console.warn(
      `  Overpass failed (${error.slice(0, 300)}), retrying in ${delay / 1000} s (${RETRIES - attempt} tries left)`,
    );
    // Added to DELAY_BETWEEN_REQUESTS
    await sleep(delay);
  }
}

/**
 * Downloads the climbing data of the whole world into `outputDir`, one file per tile, skipping
 * the tiles that are already downloaded. Returns the tile files.
 * @param worldPointsFile Cache of the world climbing places, used to size the tiles if it exists
 */
export async function downloadOSMData(outputDir: string, worldPointsFile: string) {
  await mkdir(outputDir, { recursive: true });
  const planFile = join(outputDir, PLAN_FILE);
  let plan: Plan;
  if (existsSync(planFile)) {
    plan = JSON.parse(await readFile(planFile, "utf8"));
  } else {
    plan = await createPlan(worldPointsFile);
    await writeFileAtomically(planFile, JSON.stringify(plan, null, 2));
  }

  const missing = plan.tiles.filter((key) => !existsSync(getTileFile(outputDir, key)));
  if (missing.length === 0) {
    console.log(
      `OSM data of the ${plan.tiles.length} tiles already exists in ${outputDir}. Skipping download.`,
    );
    return plan.tiles.map((key) => getTileFile(outputDir, key));
  }
  console.log(
    `📡 Downloading ${missing.length} of ${plan.tiles.length} tiles into ${outputDir} (one request at a time, at least ${DELAY_BETWEEN_REQUESTS / 1000} s apart)`,
  );

  // Strictly sequential: the tiles are downloaded one after the other
  const queue = [...missing];
  let done = plan.tiles.length - missing.length;
  while (queue.length > 0) {
    const key = queue.shift()!;
    const { west, south, east, north } = getTileBBox(key);
    console.log(`[${done + 1}/${plan.tiles.length}] ${key} (${west},${south} → ${east},${north})`);
    const start = Date.now();
    try {
      const body = await downloadTile(key);
      await writeFileAtomically(getTileFile(outputDir, key), body);
      done++;
      console.log(
        `  ${(body.length / 1e6).toFixed(1)} MB in ${((Date.now() - start) / 1000).toFixed(0)} s`,
      );
    } catch (e) {
      if (!(e instanceof TileTooLargeError) || getDepth(key) >= MAX_DEPTH) throw e;
      console.warn(`  Too large for Overpass (${e.message}), splitting it in 4`);
      const children = getChildren(key);
      plan.tiles.splice(plan.tiles.indexOf(key), 1, ...children);
      await writeFileAtomically(planFile, JSON.stringify(plan, null, 2));
      queue.unshift(...children);
    }
  }
  console.log(`✅ OSM data of the ${plan.tiles.length} tiles saved to ${outputDir}`);
  return plan.tiles.map((key) => getTileFile(outputDir, key));
}
