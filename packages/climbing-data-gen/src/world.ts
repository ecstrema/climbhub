import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { request } from "https";
import { USER_AGENT } from "@climbhub/reverse-geocoding-data";
import { tryOverpassInstances } from "@climbhub/common";

import { parseWorldClimbingPoints, WORLD_CLIMBING_QUERY, type WorldClimbingPoints } from "./world-points.ts";

export * from "./world-points.ts";

const RETRIES = 10;
/** Pause between two Overpass requests. Requests are never made in parallel. */
const DELAY_BETWEEN_REQUESTS = 5_000;
/** First wait after a failure, doubled on each retry */
const RETRY_DELAY = 30_000;
const MAX_RETRY_DELAY = 5 * 60_000;

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
export function postOverpass(query: string, validateResponse?: (data: any) => void): Promise<string> {
  return tryOverpassInstances(async (endpoint) => {
    const body = await postOverpassToEndpoint(query, endpoint);
    const data = JSON.parse(body);
    if (!Array.isArray(data.elements) || data.remark?.toLowerCase().includes("error")) {
      throw new Error(data.remark || "Overpass returned an invalid response");
    }
    validateResponse?.(data);
    return body;
  });
}

function postOverpassToEndpoint(query: string, endpoint: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = request(
      endpoint,
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
      return JSON.parse(await enqueue(() => postOverpass(WORLD_CLIMBING_QUERY)));
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
  const result = parseWorldClimbingPoints(data);
  await writeFile(outputFilePath, JSON.stringify(result));
  console.log(`✅ ${result.points.length} climbing places saved to ${outputFilePath}`);
  return result;
}
