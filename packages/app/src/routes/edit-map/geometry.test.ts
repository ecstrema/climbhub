import { describe, expect, it } from "vitest";
import type { Position } from "geojson";

import {
  boundaryPolygons,
  insertOnSegment,
  polygonsContain,
  positionKey,
  preparePolygons,
  sharedVertexIndex,
  simplifyBoundary,
} from "./geometry";
import type { Boundary } from "./types";

function polygon(ring: Position[]): Boundary {
  return {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...ring, ring[0]!]] } },
    ],
  };
}

/** A wiggly line from (0, 0) to (0, 10), shared by the two polygons below */
const border: Position[] = Array.from({ length: 101 }, (_, i) => [Math.sin(i) * 0.01, i / 10]);
const west = polygon([...border, [-5, 10], [-5, 0]]);
const east = polygon([[5, 0], [5, 10], ...[...border].reverse()]);

describe("point in polygon", () => {
  it("handles holes", () => {
    const withHole: Boundary = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
              [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
            ],
          },
        },
      ],
    };
    const prepared = preparePolygons(boundaryPolygons(withHole));
    expect(polygonsContain(prepared, 1, 1)).toBe(true);
    expect(polygonsContain(prepared, 5, 5)).toBe(false);
    expect(polygonsContain(prepared, 11, 5)).toBe(false);
  });
});

describe("simplifyBoundary", () => {
  const index = sharedVertexIndex([
    { id: "west", boundary: west },
    { id: "east", boundary: east },
  ]);
  const sharers = (p: Position) => [...(index.get(positionKey(p)) ?? [])].sort().join(",");

  it("simplifies the shared border identically in both polygons", () => {
    const options = { tolerance: 0.05, sharers, locked: () => false };
    const w = boundaryPolygons(simplifyBoundary(west, options))[0]![0]!;
    const e = boundaryPolygons(simplifyBoundary(east, options))[0]![0]!;

    const onBorder = (ring: Position[]) =>
      new Set(ring.filter((p) => Math.abs(p[0]!) < 1).map(positionKey));
    expect(onBorder(w).size).toBeLessThan(border.length);
    expect(onBorder(w)).toEqual(onBorder(e));
  });

  it("keeps the locked vertices", () => {
    const options = { tolerance: 1, sharers, locked: (p: Position) => Math.abs(p[0]!) < 1 };
    const w = boundaryPolygons(simplifyBoundary(west, options))[0]![0]!;
    expect(w.length).toBe(west.features[0]!.geometry.coordinates[0]!.length);
  });

  it("does not remove everything", () => {
    const tiny = polygon([[0, 0], [0.001, 0], [0.001, 0.001]]);
    const result = simplifyBoundary(tiny, { tolerance: 1, sharers: () => "", locked: () => false });
    expect(boundaryPolygons(result)).toHaveLength(1);
  });
});

describe("insertOnSegment", () => {
  it("inserts in both directions", () => {
    const a = polygon([[0, 0], [1, 0], [1, 1]]);
    const b = polygon([[1, 0], [0, 0], [0, -1]]);
    for (const boundary of [a, b]) insertOnSegment(boundary, [0, 0], [1, 0], [0.5, 0]);
    expect(boundaryPolygons(a)[0]![0]).toContainEqual([0.5, 0]);
    expect(boundaryPolygons(b)[0]![0]).toContainEqual([0.5, 0]);
    expect(boundaryPolygons(a)[0]![0]).toHaveLength(5);
  });
});
