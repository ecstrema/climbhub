// Browser-safe part of the world climbing places: no node imports. The boundary editor of the app
// runs this query itself on the deployed site.
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
export const WORLD_CLIMBING_QUERY = `
[out:json][timeout:600];
// Every climbing place, except individual routes
(
  nwr["sport"="climbing"]["climbing"!~"^route"];
  nwr["leisure"="pitch"];
  nwr["climbing"~"^(area|crag|boulder)(;.*)?$"];
);
out tags center qt;`;
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
  if (
    tags.leisure === "pitch" ||
    ((tags.leisure === "sports_centre" || tags.leisure === "sports_hall" || tags.leisure === "fitness_centre") &&
      tags.sport === "climbing")
  ) {
    return "gym";
  }
  return "other";
}

export function toClimbingPoint(el: OsmFeature): ClimbingPoint | undefined {
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

/** Converts the Overpass result of WORLD_CLIMBING_QUERY */
export function parseWorldClimbingPoints(data: any): WorldClimbingPoints {
  const points = (data.elements as OsmFeature[]).map(toClimbingPoint).filter((p) => p !== undefined);
  return { timestamp: data.osm3s?.timestamp_osm_base ?? "", points };
}
