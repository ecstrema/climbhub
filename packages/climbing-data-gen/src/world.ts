import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { request } from "https";
import { USER_AGENT } from "@climbhub/reverse-geocoding-data";
import type { OsmFeature } from "osm-api";

/**
 * Lightweight version of the climbing data, for the whole world. It only contains the places
 * (crags, areas, boulders, gyms), not the routes, and only a representative point for each.
 * This is what the boundary editor (packages/app/src/routes/edit-map) uses to decide how to
 * split the world into regions.
 */
export type ClimbingPointKind = "crag" | "area" | "boulder" | "gym" | "other";

export interface ClimbingPoint {
  /** `n123`, `w123` or `r123` */
  id: string;
  lon: number;
  lat: number;
  kind: ClimbingPointKind;
  name?: string;
}

export interface WorldClimbingPoints {
  /** ISO date of the OSM data */
  timestamp: string;
  points: ClimbingPoint[];
}

// Overpass only answers once the whole query has run, which can take several minutes. It may
// refuse the query when it is busy ("Dispatcher_Client::request_read_and_idx::timeout"): then
// retry later.
const QUERY = `
[out:json][timeout:600];
// Every climbing place, except individual routes
nwr["sport"="climbing"]["climbing"!~"^route"];
out tags center qt;`;
const RETRIES = 10;
/** Pause between two Overpass requests. Requests are never made in parallel. */
const DELAY_BETWEEN_REQUESTS = 5_000;
/** First wait after a failure, doubled on each retry */
const RETRY_DELAY = 30_000;
const MAX_RETRY_DELAY = 5 * 60_000;

function getKind(tags: Record<string, string>): ClimbingPointKind {
  switch (tags.climbing) {
    case "crag":
      return "crag";
    case "area":
      return "area";
    case "boulder":
      return "boulder";
  }
  if (tags.type === "site") return "area";
  if (tags.leisure === "sports_centre" || tags.leisure === "fitness_centre") return "gym";
  return "other";
}

function toClimbingPoint(el: OsmFeature): ClimbingPoint | undefined {
  // @ts-ignore `center` is added by `out center`
  const coordinates: { lat: number; lon: number } | undefined = el.type === "node" ? el : el.center;
  if (!coordinates) return;

  const tags = (el.tags ?? {}) as Record<string, string>;
  return {
    id: `${el.type[0]}${el.id}`,
    lon: coordinates.lon,
    lat: coordinates.lat,
    kind: getKind(tags),
    name: tags.name || tags.official_name || undefined,
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * State shared by every instance of this module: Vite reloads it on each change during
 * development, and each reload must not start another download nor bypass the queue.
 */
interface SharedState {
  /** Resolves when the previous Overpass request (and the pause after it) is done */
  queue: Promise<unknown>;
  job?: DownloadJob;
}
const shared: SharedState = ((globalThis as any).__climbhubWorldClimbing ??= {
  queue: Promise.resolve(),
});

/** Runs `request` after all the previously queued ones, so that Overpass gets one request at a time */
function enqueue<T>(request: () => Promise<T>): Promise<T> {
  const result = shared.queue.then(request);
  shared.queue = result.catch(() => {}).then(() => sleep(DELAY_BETWEEN_REQUESTS));
  return result;
}

/**
 * POSTs the query with `https` rather than `fetch`: `fetch` gives up when the response headers
 * take more than 5 minutes, and Overpass sends them only when the query is done.
 */
function postOverpass(query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = request(
      "https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
          "Content-Type": "text/plain; charset=utf-8",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("error", reject);
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode === 200) resolve(body);
          else reject(new Error(`${res.statusCode} ${res.statusMessage}: ${body.slice(0, 500)}`));
        });
      },
    );
    req.on("error", reject);
    req.end(query);
  });
}

async function runQuery(onRetry: (error: string) => void): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    try {
      return JSON.parse(await enqueue(() => postOverpass(QUERY)));
    } catch (e) {
      // Network errors (connection refused or reset) are retried like HTTP errors
      const error = e instanceof Error ? e.message : String(e);
      if (attempt >= RETRIES) throw new Error(`Failed to download OSM data: ${error}`);
      const delay = Math.min(RETRY_DELAY * 2 ** attempt, MAX_RETRY_DELAY);
      const message = `Overpass failed (${error}), retrying in ${delay / 1000} s (${RETRIES - attempt} tries left)`;
      console.warn(message);
      onRetry(message);
      await sleep(delay);
    }
  }
}

export interface WorldDownloadStatus {
  /** ISO date at which the download started */
  startedAt: string;
  /** Last error, if the query is being retried */
  retrying?: string;
  /** Set when the download failed for good */
  error?: string;
}

interface DownloadJob {
  status: WorldDownloadStatus;
  promise: Promise<WorldClimbingPoints>;
}

/**
 * Returns the climbing places of the whole world, cached in `outputFilePath`. When they are not
 * cached yet (or with `force`), starts downloading them in the background, once whatever the
 * number of callers, and returns the progress instead.
 */
export async function getWorldClimbingPoints(
  outputFilePath: string,
  { force = false } = {},
): Promise<{ data: WorldClimbingPoints } | { status: WorldDownloadStatus }> {
  const job = shared.job;
  if (job && !job.status.error) return { status: job.status };
  if (!force && !job && existsSync(outputFilePath)) {
    return { data: JSON.parse(await readFile(outputFilePath, "utf8")) };
  }

  // Start (or restart after a failure)
  const status: WorldDownloadStatus = { startedAt: new Date().toISOString() };
  const promise = download(outputFilePath, status);
  shared.job = { status, promise };
  promise.then(
    () => shared.job?.promise === promise && (shared.job = undefined),
    (e) => (status.error = e instanceof Error ? e.message : String(e)),
  );
  return { status };
}

/** Downloads all the climbing places of the world, and caches them in `outputFilePath`. */
export async function downloadWorldClimbingPoints(outputFilePath: string): Promise<WorldClimbingPoints> {
  return download(outputFilePath, { startedAt: new Date().toISOString() });
}

async function download(outputFilePath: string, status: WorldDownloadStatus): Promise<WorldClimbingPoints> {
  console.log("📡 Downloading the climbing places of the whole world...");
  const data = await runQuery((error) => (status.retrying = error));
  const points = (data.elements as OsmFeature[]).map(toClimbingPoint).filter((p) => p !== undefined);

  const result: WorldClimbingPoints = { timestamp: data.osm3s?.timestamp_osm_base ?? "", points };
  await writeFile(outputFilePath, JSON.stringify(result));
  console.log(`✅ ${points.length} climbing places saved to ${outputFilePath}`);
  return result;
}
