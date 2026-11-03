import osmtogeojson from "osmtogeojson";
import { tryOverpassInstances } from "@climbhub/common";
import { slugify } from "@climbhub/reverse-geocoding-data/shared";
import { toBoundary } from "./geometry";
import type { Boundary } from "./types";

export { slugify };

/** Pause between two Overpass requests. Requests are never made in parallel. */
const DELAY_BETWEEN_REQUESTS = 3_000;
let queue: Promise<unknown> = Promise.resolve();

/** Runs a query after the previously queued ones, so that Overpass gets one request at a time */
export function runOverpassQuery(query: string, signal?: AbortSignal): Promise<Boundary> {
  return enqueue(async () => toBoundary(osmtogeojson(await fetchOverpass(query, signal))));
}

function enqueue<T>(request: () => Promise<T>): Promise<T> {
  const result = queue.then(request);
  queue = result.catch(() => {}).then(() => new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS)));
  return result;
}

/** Runs a query, and returns the raw Overpass JSON */
export function runRawOverpassQuery(query: string, signal?: AbortSignal): Promise<any> {
  return enqueue(() => fetchOverpass(query, signal));
}

async function fetchOverpass(query: string, signal?: AbortSignal): Promise<any> {
  signal?.throwIfAborted();
  return tryOverpassInstances(async (endpoint) => {
    const res = await fetch(endpoint, {
      method: "POST",
      body: query,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      signal,
    });
    if (!res.ok) {
      throw new Error(`Overpass error ${res.status}: ${res.statusText}\n${await res.text()}`);
    }
    const data = await res.json();
    if (!Array.isArray(data.elements) || data.remark?.toLowerCase().includes("error")) {
      throw new Error(data.remark || "Overpass returned an invalid response");
    }
    return data;
  });
}

/** Splits the result of a query by feature, named after the slug of their name. */
export function splitBySlug(boundary: Boundary): Map<string, Boundary> {
  const children = new Map<string, Boundary>();
  for (const feature of boundary.features) {
    const name = feature.properties?.official_name || feature.properties?.name;
    if (!name) continue;
    // The last feature with the same slug wins
    children.set(slugify(name), { type: "FeatureCollection", features: [feature] });
  }
  return children;
}

/** Query to get all the administrative subdivisions of an area. */
export function adminSubdivisionQuery(isoCode: string, adminLevel: number) {
  const key = isoCode.includes("-") ? "ISO3166-2" : "ISO3166-1";
  return `[out:json][timeout:90];
area["${key}"="${isoCode}"]->.parent;
relation["boundary"="administrative"]["admin_level"="${adminLevel}"](area.parent);
out geom;
`;
}

/** Query to get the boundary of a single area. */
export function singleAreaQuery(isoCode: string) {
  const key = isoCode.includes("-") ? "ISO3166-2" : "ISO3166-1";
  return `[out:json][timeout:90];
relation["boundary"="administrative"]["${key}"="${isoCode}"];
out geom;
`;
}
