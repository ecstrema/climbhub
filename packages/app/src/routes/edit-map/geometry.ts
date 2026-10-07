import type { Position } from "geojson";
import type { Boundary } from "./types";

export interface BBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export function emptyBBox(): BBox {
  return { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
}

export function isEmptyBBox(b: BBox) {
  return b.x0 > b.x1;
}

export function mergeBBox(a: BBox, b: BBox): BBox {
  return {
    x0: Math.min(a.x0, b.x0),
    x1: Math.max(a.x1, b.x1),
    y0: Math.min(a.y0, b.y0),
    y1: Math.max(a.y1, b.y1),
  };
}

export function bboxContains(b: BBox, lon: number, lat: number) {
  return lon >= b.x0 && lon <= b.x1 && lat >= b.y0 && lat <= b.y1;
}

export function bboxIntersects(a: BBox, b: BBox) {
  return a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0;
}

/** Rings of a boundary, as `polygons[polygon][ring][vertex]`. The first ring of a polygon is the outer one. */
export type Rings = Position[][][];

/** All the polygons of a boundary. Points and lines are ignored, as in the reverse geolocator. */
export function boundaryPolygons(boundary: Boundary | undefined): Rings {
  const polygons: Rings = [];
  for (const feature of boundary?.features ?? []) {
    const geometry = feature.geometry;
    if (geometry?.type === "Polygon") polygons.push(geometry.coordinates);
    else if (geometry?.type === "MultiPolygon") polygons.push(...geometry.coordinates);
  }
  return polygons;
}

export function countVertices(boundary: Boundary | undefined) {
  let count = 0;
  for (const polygon of boundaryPolygons(boundary)) {
    for (const ring of polygon) count += Math.max(0, ring.length - 1);
  }
  return count;
}

export function ringsBBox(polygons: Rings): BBox {
  const b = emptyBBox();
  for (const polygon of polygons) {
    for (const [lon, lat] of polygon[0] ?? []) {
      if (lon! < b.x0) b.x0 = lon!;
      if (lon! > b.x1) b.x1 = lon!;
      if (lat! < b.y0) b.y0 = lat!;
      if (lat! > b.y1) b.y1 = lat!;
    }
  }
  return b;
}

/** Flattened polygons, for a fast point-in-polygon test. */
export interface PreparedPolygon {
  bbox: BBox;
  /** Outer ring first, then the holes. Each ring is [lon0, lat0, lon1, lat1, ...] */
  rings: Float64Array[];
}

export function preparePolygons(polygons: Rings): PreparedPolygon[] {
  return polygons
    .filter((polygon) => (polygon[0]?.length ?? 0) >= 4)
    .map((polygon) => ({
      bbox: ringsBBox([polygon]),
      rings: polygon.map((ring) => {
        const flat = new Float64Array(ring.length * 2);
        ring.forEach(([lon, lat], i) => {
          flat[2 * i] = lon!;
          flat[2 * i + 1] = lat!;
        });
        return flat;
      }),
    }));
}

function ringContains(ring: Float64Array, x: number, y: number) {
  let inside = false;
  const n = ring.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[2 * i]!,
      yi = ring[2 * i + 1]!;
    const xj = ring[2 * j]!,
      yj = ring[2 * j + 1]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function polygonsContain(polygons: PreparedPolygon[], lon: number, lat: number) {
  for (const polygon of polygons) {
    if (!bboxContains(polygon.bbox, lon, lat)) continue;
    if (!ringContains(polygon.rings[0]!, lon, lat)) continue;
    let inHole = false;
    for (let r = 1; r < polygon.rings.length; r++) {
      if (ringContains(polygon.rings[r]!, lon, lat)) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }
  return false;
}

/** Address of a vertex in a boundary. The closing vertex of a ring is never addressed. */
export interface VertexRef {
  feature: number;
  /** Index of the polygon inside a MultiPolygon, 0 for a Polygon */
  polygon: number;
  ring: number;
  vertex: number;
}

/** Calls `fn` for each ring of the boundary, with its address. */
export function forEachRing(
  boundary: Boundary,
  fn: (ring: Position[], ref: Omit<VertexRef, "vertex">) => void,
) {
  boundary.features.forEach((feature, f) => {
    const geometry = feature.geometry;
    if (geometry?.type === "Polygon") {
      geometry.coordinates.forEach((ring, r) => fn(ring, { feature: f, polygon: 0, ring: r }));
    } else if (geometry?.type === "MultiPolygon") {
      geometry.coordinates.forEach((polygon, p) =>
        polygon.forEach((ring, r) => fn(ring, { feature: f, polygon: p, ring: r })),
      );
    }
  });
}

export function getRing(boundary: Boundary, ref: Omit<VertexRef, "vertex">): Position[] | undefined {
  const geometry = boundary.features[ref.feature]?.geometry;
  if (geometry?.type === "Polygon") return geometry.coordinates[ref.ring];
  if (geometry?.type === "MultiPolygon") return geometry.coordinates[ref.polygon]?.[ref.ring];
}

/** Moves a vertex, keeping the ring closed. */
export function moveVertex(boundary: Boundary, ref: VertexRef, position: Position) {
  const ring = getRing(boundary, ref);
  if (!ring) return;
  ring[ref.vertex] = position;
  if (ref.vertex === 0) ring[ring.length - 1] = position;
}

/** Inserts a vertex after `ref`. */
export function insertVertex(boundary: Boundary, ref: VertexRef, position: Position) {
  getRing(boundary, ref)?.splice(ref.vertex + 1, 0, position);
}

/** Removes a vertex. Returns false when the ring would become degenerate. */
export function removeVertex(boundary: Boundary, ref: VertexRef) {
  const ring = getRing(boundary, ref);
  if (!ring || ring.length <= 4) return false;
  ring.splice(ref.vertex, 1);
  if (ref.vertex === 0) ring[ring.length - 1] = ring[0]!;
  return true;
}

export function positionKey(p: Position) {
  return `${p[0]},${p[1]}`;
}

/** A point roughly in the middle of the largest polygon, to put a label. */
export function labelPoint(polygons: Rings): Position | undefined {
  let best: Position[] | undefined;
  let bestArea = -1;
  for (const polygon of polygons) {
    const b = ringsBBox([polygon]);
    const area = (b.x1 - b.x0) * (b.y1 - b.y0);
    if (area > bestArea) {
      bestArea = area;
      best = polygon[0];
    }
  }
  if (!best) return;

  // Pick the middle of the widest horizontal chord crossing the vertical middle of the polygon.
  const b = ringsBBox([[best]]);
  const y = (b.y0 + b.y1) / 2;
  const xs: number[] = [];
  for (let i = 0; i < best.length - 1; i++) {
    const [x1, y1] = best[i]!;
    const [x2, y2] = best[i + 1]!;
    if (y1! > y !== y2! > y) xs.push(x1! + ((y - y1!) * (x2! - x1!)) / (y2! - y1!));
  }
  xs.sort((a, b) => a - b);
  let bestChord: Position = [(b.x0 + b.x1) / 2, y];
  let bestWidth = -1;
  for (let i = 0; i + 1 < xs.length; i += 2) {
    const width = xs[i + 1]! - xs[i]!;
    if (width > bestWidth) {
      bestWidth = width;
      bestChord = [(xs[i]! + xs[i + 1]!) / 2, y];
    }
  }
  return bestChord;
}

// ---------------------------------------------------------------------------------------------
// Simplification
// ---------------------------------------------------------------------------------------------

function segmentDistanceSq(p: Position, a: Position, b: Position) {
  let x = a[0]!,
    y = a[1]!;
  let dx = b[0]! - x,
    dy = b[1]! - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0]! - x) * dx + (p[1]! - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0]!;
      y = b[1]!;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0]! - x;
  dy = p[1]! - y;
  return dx * dx + dy * dy;
}

/** Douglas-Peucker on `points[first..last]`, marking the kept points. Iterative to support huge rings. */
function douglasPeucker(
  points: Position[],
  first: number,
  last: number,
  toleranceSq: number,
  keep: Uint8Array,
) {
  const stack: [number, number][] = [[first, last]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let maxDistance = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = segmentDistanceSq(points[i]!, points[start]!, points[end]!);
      if (d > maxDistance) {
        maxDistance = d;
        index = i;
      }
    }
    if (index !== -1 && maxDistance > toleranceSq) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
}

/**
 * Simplifies a closed ring. Vertices flagged in `fixed` are always kept, and the ring is simplified
 * independently between them, so that borders shared by several rings simplify identically.
 * Returns undefined when the ring collapses.
 */
export function simplifyRing(
  ring: Position[],
  toleranceSq: number,
  fixed: (index: number) => boolean,
): Position[] | undefined {
  const n = ring.length - 1; // without the closing vertex
  if (n < 3) return;

  const fixedIndexes: number[] = [];
  for (let i = 0; i < n; i++) if (fixed(i)) fixedIndexes.push(i);

  // Without fixed vertices, use the first vertex and the vertex farthest from it.
  if (fixedIndexes.length === 0) {
    let far = 0;
    let farDistance = -1;
    for (let i = 1; i < n; i++) {
      const dx = ring[i]![0]! - ring[0]![0]!;
      const dy = ring[i]![1]! - ring[0]![1]!;
      if (dx * dx + dy * dy > farDistance) {
        farDistance = dx * dx + dy * dy;
        far = i;
      }
    }
    fixedIndexes.push(0, far);
  }

  // Rotate the ring so that it starts at a fixed vertex, and unroll it to a polyline.
  const start = fixedIndexes[0]!;
  const unrolled: Position[] = [];
  for (let i = 0; i <= n; i++) unrolled.push(ring[(start + i) % n]!);
  const keep = new Uint8Array(n + 1);
  const anchors = [...fixedIndexes.map((i) => i - start), n];
  for (const a of anchors) keep[a] = 1;
  for (let i = 0; i + 1 < anchors.length; i++) {
    douglasPeucker(unrolled, anchors[i]!, anchors[i + 1]!, toleranceSq, keep);
  }

  const result = unrolled.filter((_, i) => keep[i]);
  if (result.length < 4) return;
  return result;
}

export interface SimplifyOptions {
  /** In degrees */
  tolerance: number;
  /** Key of the set of boundaries using each vertex, see {@link sharedVertexIndex} */
  sharers: (p: Position) => string;
  /** Vertices that must never move or disappear, e.g. vertices shared with regions outside of the simplified group */
  locked: (p: Position) => boolean;
}

/**
 * Simplifies all the polygons of the boundary, keeping the junctions between neighbouring
 * boundaries, so that the shared borders stay identical. Returns a new boundary.
 */
export function simplifyBoundary(boundary: Boundary, options: SimplifyOptions): Boundary {
  const toleranceSq = options.tolerance * options.tolerance;

  const simplifyRings = (rings: Position[][]) => {
    const result: Position[][] = [];
    for (const [r, ring] of rings.entries()) {
      const n = ring.length - 1;
      const keys = ring.map(options.sharers);
      const simplified = simplifyRing(ring, toleranceSq, (i) => {
        if (options.locked(ring[i]!)) return true;
        // A junction: the set of boundaries sharing the vertex changes
        const previous = keys[(i - 1 + n) % n];
        const next = keys[(i + 1) % n];
        return keys[i] !== previous || keys[i] !== next;
      });
      if (simplified) result.push(simplified);
      // The outer ring collapsed: drop the whole polygon
      else if (r === 0) return;
    }
    return result;
  };

  return {
    ...boundary,
    features: boundary.features.map((feature) => {
      const geometry = feature.geometry;
      if (geometry?.type === "Polygon") {
        const coordinates = simplifyRings(geometry.coordinates) ?? geometry.coordinates;
        return { ...feature, geometry: { type: "Polygon", coordinates } };
      }
      if (geometry?.type === "MultiPolygon") {
        const polygons = geometry.coordinates.map(simplifyRings).filter((p) => !!p);
        // Never remove everything: keep the largest polygon untouched if all of them collapsed
        const coordinates = polygons.length ? polygons : geometry.coordinates;
        return { ...feature, geometry: { type: "MultiPolygon", coordinates } };
      }
      return feature;
    }),
  };
}

/**
 * Index of the vertices of several boundaries: for each position, the set of boundaries using it.
 * Used to move shared vertices together, and to keep shared borders when simplifying.
 */
export function sharedVertexIndex(boundaries: { id: string; boundary: Boundary }[]) {
  const index = new Map<string, Set<string>>();
  for (const { id, boundary } of boundaries) {
    for (const polygon of boundaryPolygons(boundary)) {
      for (const ring of polygon) {
        for (const p of ring) {
          const key = positionKey(p);
          let set = index.get(key);
          if (!set) index.set(key, (set = new Set()));
          set.add(id);
        }
      }
    }
  }
  return index;
}

/** Finds every vertex at `position` in the boundary. */
export function findVertices(boundary: Boundary, position: Position): VertexRef[] {
  const refs: VertexRef[] = [];
  forEachRing(boundary, (ring, ref) => {
    for (let v = 0; v < ring.length - 1; v++) {
      const p = ring[v]!;
      if (p[0] === position[0] && p[1] === position[1]) refs.push({ ...ref, vertex: v });
    }
  });
  return refs;
}

export function cloneBoundary(boundary: Boundary | undefined): Boundary | undefined {
  return boundary && structuredClone(boundary);
}

/** A boundary which is a rectangle */
export function rectangleBoundary(b: BBox, properties: Record<string, unknown> = {}): Boundary {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties,
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [b.x0, b.y0],
              [b.x1, b.y0],
              [b.x1, b.y1],
              [b.x0, b.y1],
              [b.x0, b.y0],
            ],
          ],
        },
      },
    ],
  };
}

/** Keeps only the polygons of any GeoJSON object. */
export function toBoundary(geojson: any): Boundary {
  const features: any[] =
    geojson?.type === "FeatureCollection"
      ? geojson.features
      : geojson?.type === "Feature"
        ? [geojson]
        : geojson?.type
          ? [{ type: "Feature", properties: {}, geometry: geojson }]
          : [];
  return {
    type: "FeatureCollection",
    features: features.filter(
      (f) => f?.geometry?.type === "Polygon" || f?.geometry?.type === "MultiPolygon",
    ),
  };
}

function samePosition(a: Position | undefined, b: Position | undefined) {
  return !!a && !!b && a[0] === b[0] && a[1] === b[1];
}

/** Inserts `position` in every segment [a, b] (in any direction) of the boundary. */
export function insertOnSegment(boundary: Boundary, a: Position, b: Position, position: Position) {
  forEachRing(boundary, (ring) => {
    for (let i = ring.length - 2; i >= 0; i--) {
      const [p, q] = [ring[i], ring[i + 1]];
      if ((samePosition(p, a) && samePosition(q, b)) || (samePosition(p, b) && samePosition(q, a))) {
        ring.splice(i + 1, 0, position);
      }
    }
  });
}
