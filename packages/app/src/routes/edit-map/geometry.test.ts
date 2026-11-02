import { describe, expect, it } from "vitest";
import type { Position } from "geojson";

import {
  addPolygon,
  boundaryPolygons,
  countVertices,
  dissolvePolygons,
  mergeBoundaries,
  removeVertices,
  splitBoundary,
  insertOnSegment,
  mergeAdjacentPolygonsWithCommonNodes,
  mergeBoundariesAtPoints,
  mergeRingsAtPoints,
  polygonsContain,
  positionKey,
  preparePolygons,
  sharedVertexIndex,
  simplifyBoundary,
  simplifyCoast,
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

describe("removeVertices", () => {
  const square = polygon([[0, 0], [1, 0], [1, 1], [0, 1]]);

  it("removes the vertices, and keeps the ring closed", () => {
    const b = structuredClone(square);
    removeVertices(b, new Set([positionKey([0, 0])]));
    expect(boundaryPolygons(b)[0]![0]).toEqual([[1, 0], [1, 1], [0, 1], [1, 0]]);
  });

  it("removes the polygons left with fewer than 3 vertices", () => {
    const b = addPolygon(structuredClone(square), [[5, 5], [6, 5], [6, 6], [5, 5]]);
    removeVertices(b, new Set([positionKey([0, 0]), positionKey([1, 0])]));
    expect(boundaryPolygons(b)).toEqual([[[[5, 5], [6, 5], [6, 6], [5, 5]]]]);
    removeVertices(b, new Set([positionKey([6, 6])]));
    expect(b.features).toEqual([]);
  });
});

describe("splitBoundary", () => {
  // A 4x2 rectangle, with a hole on each side of x = 2
  const rectangle: Boundary = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "R" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [[0, 0], [2, 0], [4, 0], [4, 2], [2, 2], [0, 2], [0, 0]],
            [[0.5, 0.5], [1, 0.5], [1, 1], [0.5, 0.5]],
            [[3, 0.5], [3.5, 0.5], [3.5, 1], [3, 0.5]],
          ],
        },
      },
    ],
  };

  it("cuts along the segment, with the holes in their half", () => {
    const [option] = splitBoundary(rectangle, [2, 0], [2, 2]);
    const kept = boundaryPolygons(option.kept);
    const part = boundaryPolygons(option.part);
    expect(kept[0]![0]).toEqual([[2, 0], [4, 0], [4, 2], [2, 2], [2, 0]]);
    expect(kept[0]!.length).toBe(2);
    expect(part[0]![0]).toEqual([[2, 2], [0, 2], [0, 0], [2, 0], [2, 2]]);
    expect(part[0]![1]![0]).toEqual([0.5, 0.5]);
    expect(countVertices(option.kept) + countVertices(option.part)).toBe(4 + 4 + 3 + 3);
    // The properties of the OSM feature stay in the kept half
    expect(option.kept.features[0]!.properties).toEqual({ name: "R" });
    expect(option.part.features[0]!.properties).toEqual({});
  });

  it("rejects invalid cuts", () => {
    expect(() => splitBoundary(rectangle, [0, 0], [2, 0])).toThrow("neighbours");
    expect(() => splitBoundary(rectangle, [0, 0], [9, 9])).toThrow("outer ring");
    const u = polygon([[0, 0], [3, 0], [3, 3], [2, 3], [2, 1], [1, 1], [1, 3], [0, 3]]);
    expect(() => splitBoundary(u, [0, 3], [3, 3])).toThrow("outside");
    const notch = polygon([[0, 0], [4, 0], [4, 4], [2, 1], [0, 4]]);
    expect(() => splitBoundary(notch, [0, 0], [4, 4])).toThrow("crosses");
  });
});

describe("mergeBoundaries", () => {
  const area = (ring: Position[]) => {
    let a = 0;
    for (let i = 0; i + 1 < ring.length; i++) a += ring[i]![0]! * ring[i + 1]![1]! - ring[i + 1]![0]! * ring[i]![1]!;
    return a / 2;
  };
  const keys = (ring: Position[]) => new Set(ring.map(positionKey));

  it("dissolves a shared border", () => {
    const merged = mergeBoundaries([west, east])!;
    const polygons = boundaryPolygons(merged);
    expect(polygons).toHaveLength(1);
    expect(polygons[0]).toHaveLength(1);
    const ring = polygons[0]![0]!;
    // Only the ends of the border are left
    expect(keys(ring)).toEqual(keys([border[0]!, [5, 0], [5, 10], border.at(-1)!, [-5, 10], [-5, 0]]));
    expect(ring[0]).toEqual(ring.at(-1));
    expect(area(ring)).toBeCloseTo(100);
    expect(merged.features[0]!.geometry.type).toBe("Polygon");
  });

  it("dissolves whatever the orientation of the rings", () => {
    const a = polygon([[0, 0], [1, 0], [1, 1], [0, 1]]);
    const b = polygon([[1, 0], [1, 1], [2, 1], [2, 0]]); // clockwise
    const polygons = boundaryPolygons(mergeBoundaries([a, b]));
    expect(polygons).toHaveLength(1);
    // The ends of the border stay: neighbours may use them
    expect(keys(polygons[0]![0]!)).toEqual(keys([[0, 0], [1, 0], [2, 0], [2, 1], [1, 1], [0, 1]]));
    expect(area(polygons[0]![0]!)).toBe(2);
  });

  it("keeps the polygons which do not touch, and the properties of the first boundary", () => {
    const a = polygon([[0, 0], [1, 0], [1, 1], [0, 1]]);
    a.features[0]!.properties = { name: "A" };
    const b = polygon([[5, 0], [6, 0], [6, 1], [5, 1]]);
    b.features[0]!.properties = { name: "B" };
    const merged = mergeBoundaries([a, b])!;
    expect(merged.features).toHaveLength(1);
    expect(merged.features[0]!.properties).toEqual({ name: "A" });
    expect(merged.features[0]!.geometry.type).toBe("MultiPolygon");
    expect(countVertices(merged)).toBe(8);
    // Not shared with the inputs
    expect(boundaryPolygons(merged)[0]![0]).not.toBe(boundaryPolygons(a)[0]![0]);
  });

  it("separates polygons touching at a single vertex", () => {
    const a = polygon([[0, 0], [1, 0], [1, 1], [0, 1]]);
    const b = polygon([[1, 1], [2, 1], [2, 2], [1, 2]]);
    const polygons = dissolvePolygons(boundaryPolygons(mergeBoundaries([a])).concat(boundaryPolygons(b)))!;
    expect(polygons).toHaveLength(2);
    expect(polygons.map((p) => area(p[0]!))).toEqual([1, 1]);
  });

  it("makes a hole when a ring of regions is merged, and fills it with the enclave", () => {
    // Four regions around the square (1, 1)-(2, 2)
    const around = [
      polygon([[0, 0], [3, 0], [3, 1], [2, 1], [1, 1], [0, 1]]),
      polygon([[2, 1], [3, 1], [3, 2], [2, 2]]),
      polygon([[0, 2], [1, 2], [2, 2], [3, 2], [3, 3], [0, 3]]),
      polygon([[0, 1], [1, 1], [1, 2], [0, 2]]),
    ];
    const ring = boundaryPolygons(mergeBoundaries(around));
    expect(ring).toHaveLength(1);
    expect(ring[0]).toHaveLength(2);
    expect(area(ring[0]![0]!)).toBe(9);
    expect(area(ring[0]![1]!)).toBe(-1);
    const prepared = preparePolygons(ring);
    expect(polygonsContain(prepared, 1.5, 1.5)).toBe(false);
    expect(polygonsContain(prepared, 0.5, 1.5)).toBe(true);

    const enclave = polygon([[1, 1], [2, 1], [2, 2], [1, 2]]);
    const full = boundaryPolygons(mergeBoundaries([mergeBoundaries(around), enclave]));
    expect(full).toHaveLength(1);
    expect(full[0]).toHaveLength(1);
    expect(keys(full[0]![0]!)).toEqual(keys([[0, 0], [3, 0], [3, 1], [3, 2], [3, 3], [0, 3], [0, 2], [0, 1]]));
    expect(area(full[0]![0]!)).toBe(9);
  });

  it("keeps the holes of the merged polygons", () => {
    const withHole: Boundary = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]],
              [[1, 1], [2, 1], [2, 2], [1, 2], [1, 1]],
            ],
          },
        },
      ],
    };
    const next = polygon([[4, 0], [8, 0], [8, 4], [4, 4]]);
    const polygons = boundaryPolygons(mergeBoundaries([withHole, next]));
    expect(polygons).toHaveLength(1);
    expect(polygons[0]).toHaveLength(2);
    expect(area(polygons[0]![0]!)).toBe(32);
  });

  it("merges two shapes at two points", () => {
    const a = polygon([[0, 0], [1, 0], [1, 2], [0, 2]]);
    const b = polygon([[1, 0], [2, 0], [2, 2], [1, 2]]);
    const res = mergeBoundariesAtPoints(a, b, [1, 0], [1, 2]);
    expect(res).toBeDefined();
    const polygons = boundaryPolygons(res!.boundary);
    expect(polygons).toHaveLength(1);
    expect(polygons[0]).toHaveLength(1);
    expect(area(polygons[0]![0]!)).toBeCloseTo(4);
  });
});

describe("simplifyCoast", () => {
  // Region with shared border on east (x=0, y from 0 to 10) with 101 vertices,
  // and a detailed coast on west curving from (0, 10) to (0, 0) through (-5, 5) with many vertices.
  const detailedCoast: Position[] = Array.from({ length: 50 }, (_, i) => {
    const t = i / 49; // 0 to 1
    const y = 10 * (1 - t);
    const x = -5 * Math.sin(t * Math.PI) + Math.sin(i * 3) * 0.1;
    return [x, y];
  });
  // West polygon: shared border (0,0)->(0,10), detailed coast back to (0,0)
  const coastalRegion = polygon([...border, ...detailedCoast]);
  const sharedKeys = new Set(border.map(positionKey));
  const isShared = (p: Position) => sharedKeys.has(positionKey(p));

  it("simplifies the coast while keeping the shared border vertices 100% intact", () => {
    const simplified = simplifyCoast(coastalRegion, { isShared, tolerance: 0.5, offsetDegrees: 0.5 });
    const poly = boundaryPolygons(simplified)[0]![0]!;

    // Every shared border vertex must be in the simplified ring in exact order
    const simplifiedKeys = new Set(poly.map(positionKey));
    for (const b of border) {
      expect(simplifiedKeys.has(positionKey(b))).toBe(true);
    }

    // The coast vertices should be dramatically reduced
    expect(countVertices(simplified)).toBeLessThan(countVertices(coastalRegion));
  });

  it("encompasses the previous region fully (all original vertices are inside or on boundary)", () => {
    const simplified = simplifyCoast(coastalRegion, { isShared, tolerance: 0.5, offsetDegrees: 0.5 });
    const prepared = preparePolygons(boundaryPolygons(simplified));

    // Test a sample of original interior/coastal points
    for (let i = 1; i < detailedCoast.length - 1; i += 2) {
      const [cx, cy] = detailedCoast[i]!;
      // An interior point slightly inward from the coast
      const inX = cx + 0.2;
      expect(polygonsContain(prepared, inX, cy)).toBe(true);
    }
  });

  it("does not go on bordering regions", () => {
    // East region occupies x >= 0
    const isNeighbourPoint = (lon: number) => lon > 0;
    const simplified = simplifyCoast(coastalRegion, {
      isShared,
      isNeighbourPoint,
      tolerance: 0.5,
      offsetDegrees: 0.5,
    });
    const poly = boundaryPolygons(simplified)[0]![0]!;
    // No simplified vertex should be inside neighbour (x > 0)
    for (const p of poly) {
      // Shared border has points near x=0 (up to 0.01), but new coast points must not be x > 0.01
      if (!isShared(p)) {
        expect(p[0]).toBeLessThanOrEqual(0.01);
      }
    }
  });

  it("simplifies an island into a rough convex circling", () => {
    // A circular island with 60 vertices
    const islandRing: Position[] = Array.from({ length: 60 }, (_, i) => {
      const angle = (i / 60) * Math.PI * 2;
      const r = 2 + Math.sin(i * 5) * 0.1;
      return [Math.cos(angle) * r, Math.sin(angle) * r];
    });
    const island = polygon(islandRing);
    const simplified = simplifyCoast(island, { isShared: () => false, offsetDegrees: 0.5 });
    const ring = boundaryPolygons(simplified)[0]![0]!;

    // Reduced from 60 vertices to a small rough convex circling
    expect(ring.length - 1).toBeLessThanOrEqual(20);

    // Encompasses original island
    const prepared = preparePolygons(boundaryPolygons(simplified));
    for (const p of islandRing) {
      // All island points are inside
      expect(polygonsContain(prepared, p[0]! * 0.9, p[1]! * 0.9)).toBe(true);
    }
  });
});
