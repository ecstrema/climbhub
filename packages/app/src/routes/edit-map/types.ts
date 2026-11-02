import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";

export type Boundary = FeatureCollection<Polygon | MultiPolygon>;

export const MAX_STAGE_AREAS = 50;

export type BoundaryState = "new" | "modified" | "staged" | "committed";
export type BoundaryStates = Record<string, BoundaryState>;

export const BOUNDARY_STATE_COLORS: Record<BoundaryState, string> = {
  new: "#2563eb",
  modified: "#d97706",
  staged: "#16a34a",
  committed: "#64748b",
};

/**
 * Files of packages/reverse-geocoding-data/data, by path relative to it
 * (`world/americas/north/canada/quebec/laurentides.geojson`).
 */
export type DataFiles = Record<string, string>;
