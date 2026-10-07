import osmtogeojson from "osmtogeojson";
import { toBoundary } from "./geometry";
import type { Boundary } from "./types";

/** Same as `slugify` of @climbhub/reverse-geocoding-data, which cannot be imported in the browser. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[–—\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/** Runs an Overpass query from the browser, and keeps only the polygons. */
/** Pause between two Overpass requests. Requests are never made in parallel. */
const DELAY_BETWEEN_REQUESTS = 3_000;
let queue: Promise<unknown> = Promise.resolve();

/** Runs a query after the previously queued ones, so that Overpass gets one request at a time */
export function runOverpassQuery(query: string, signal?: AbortSignal): Promise<Boundary> {
  const result = queue.then(() => fetchOverpass(query, signal));
  queue = result
    .catch(() => {})
    .then(() => new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS)));
  return result;
}

async function fetchOverpass(query: string, signal?: AbortSignal): Promise<Boundary> {
  signal?.throwIfAborted();
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: query,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    signal,
  });
  if (!res.ok) {
    throw new Error(`Overpass error ${res.status}: ${res.statusText}\n${await res.text()}`);
  }
  return toBoundary(osmtogeojson(await res.json()));
}

/** Splits the result of a `multiple: true` query by child, exactly as the pipeline does. */
export function splitMultipleResult(boundary: Boundary): Map<string, Boundary> {
  const children = new Map<string, Boundary>();
  for (const feature of boundary.features) {
    const name = feature.properties?.official_name || feature.properties?.name;
    if (!name) continue;
    // The pipeline overwrites with the last feature with the same slug
    children.set(slugify(name), { type: "FeatureCollection", features: [feature] });
  }
  return children;
}

/** Query to get all the administrative subdivisions of an area, to use with `multiple: true`. */
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
