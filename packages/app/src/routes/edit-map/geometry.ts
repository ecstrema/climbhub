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
export function forEachRing(boundary: Boundary, fn: (ring: Position[], ref: Omit<VertexRef, "vertex">) => void) {
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

/**
 * Removes every vertex whose {@link positionKey} is in `keys`. A ring left with fewer than 3
 * vertices is removed, and so are a polygon without its outer ring, and a feature without polygon.
 */
export function removeVertices(boundary: Boundary, keys: Set<string>) {
  const cleanRings = (rings: Position[][]): Position[][] | undefined => {
    const result: Position[][] = [];
    for (const [r, ring] of rings.entries()) {
      const kept = ring.slice(0, -1).filter((p) => !keys.has(positionKey(p)));
      if (kept.length >= 3) result.push([...kept, kept[0]!]);
      else if (r === 0) return;
    }
    return result;
  };
  boundary.features = boundary.features.filter((feature) => {
    const geometry = feature.geometry;
    if (geometry?.type === "Polygon") {
      const rings = cleanRings(geometry.coordinates);
      if (!rings) return false;
      geometry.coordinates = rings;
    } else if (geometry?.type === "MultiPolygon") {
      geometry.coordinates = geometry.coordinates.map(cleanRings).filter((p) => !!p);
      if (!geometry.coordinates.length) return false;
    }
    return true;
  });
}

/** Adds a polygon to the first feature of the boundary. Returns the boundary, created if needed. */
export function addPolygon(boundary: Boundary | undefined, ring: Position[]): Boundary {
  const feature = boundary?.features[0];
  if (!boundary || !feature) {
    return {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }],
    };
  }
  const geometry = feature.geometry;
  feature.geometry = {
    type: "MultiPolygon",
    coordinates: geometry.type === "Polygon" ? [geometry.coordinates, [ring]] : [...geometry.coordinates, [ring]],
  };
  return boundary;
}

export function positionKey(p: Position) {
  return `${p[0]},${p[1]}`;
}

/** Whether the segments [a, b] and [c, d] cross, touching excluded */
function segmentsCross(a: Position, b: Position, c: Position, d: Position) {
  const orientation = (p: Position, q: Position, r: Position) =>
    Math.sign((q[0]! - p[0]!) * (r[1]! - p[1]!) - (q[1]! - p[1]!) * (r[0]! - p[0]!));
  return orientation(a, b, c) * orientation(a, b, d) < 0 && orientation(c, d, a) * orientation(c, d, b) < 0;
}

function ringArea(ring: Position[]) {
  let area = 0;
  for (let i = 0; i + 1 < ring.length; i++) {
    area += ring[i]![0]! * ring[i + 1]![1]! - ring[i + 1]![0]! * ring[i]![1]!;
  }
  return Math.abs(area) / 2;
}

/** One way to split a boundary: `kept` stays in the region, `part` goes to a new region */
export interface SplitOption {
  kept: Boundary;
  part: Boundary;
}

/**
 * Cuts the polygon having `a` and `b` on its outer ring along the segment [a, b]. Returns the two
 * ways to assign the halves, the one moving the smallest half first. Throws if the cut is invalid.
 */
export function splitBoundary(boundary: Boundary, a: Position, b: Position): [SplitOption, SplitOption] {
  const [ka, kb] = [positionKey(a), positionKey(b)];
  let found: { ref: Omit<VertexRef, "vertex">; rings: Position[][]; i: number; j: number } | undefined;
  forEachRing(boundary, (ring, ref) => {
    if (found || ref.ring !== 0) return;
    const keys = ring.slice(0, -1).map(positionKey);
    const [i, j] = [keys.indexOf(ka), keys.indexOf(kb)];
    if (i === -1 || j === -1) return;
    const geometry = boundary.features[ref.feature]!.geometry;
    const rings = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates[ref.polygon]!;
    found = { ref, rings, i: Math.min(i, j), j: Math.max(i, j) };
  });
  if (!found) throw new Error("The two vertices must be on the outer ring of the same polygon");

  const { ref, rings, i, j } = found;
  const outer = rings[0]!.slice(0, -1);
  const n = outer.length;
  if (j - i < 2 || n - (j - i) < 2) throw new Error("The two vertices are neighbours: there is nothing to cut");
  for (const ring of rings) {
    for (let k = 0; k + 1 < ring.length; k++) {
      if (segmentsCross(a, b, ring[k]!, ring[k + 1]!)) throw new Error("The cut crosses the boundary");
    }
  }
  const middle = [(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2];
  if (!polygonsContain(preparePolygons([rings]), middle[0]!, middle[1]!)) {
    throw new Error("The cut goes outside of the region");
  }

  const first = outer.slice(i, j + 1);
  const second = [...outer.slice(j), ...outer.slice(0, i + 1)];
  const halves = [[[...first, first[0]!]], [[...second, second[0]!]]];
  const prepared = preparePolygons([halves[0]!]);
  for (const hole of rings.slice(1)) {
    halves[polygonsContain(prepared, hole[0]![0]!, hole[0]![1]!) ? 0 : 1]!.push(hole);
  }

  const option = (keep: number): SplitOption => {
    const kept = cloneBoundary(boundary)!;
    const geometry = kept.features[ref.feature]!.geometry;
    if (geometry.type === "Polygon") geometry.coordinates = halves[keep]!;
    else geometry.coordinates[ref.polygon] = halves[keep]!;
    const part: Boundary = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: halves[1 - keep]! },
        },
      ],
    };
    return { kept, part };
  };
  const firstIsSmaller = ringArea(halves[0]![0]!) < ringArea(halves[1]![0]!);
  return firstIsSmaller ? [option(1), option(0)] : [option(0), option(1)];
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
function douglasPeucker(points: Position[], first: number, last: number, toleranceSq: number, keep: Uint8Array) {
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
    features: features.filter((f) => f?.geometry?.type === "Polygon" || f?.geometry?.type === "MultiPolygon"),
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

// ---------------------------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------------------------

function signedRingArea(ring: Position[]) {
  let area = 0;
  for (let i = 0; i + 1 < ring.length; i++) {
    area += ring[i]![0]! * ring[i + 1]![1]! - ring[i + 1]![0]! * ring[i]![1]!;
  }
  return area / 2;
}

/**
 * Union of polygons which touch only along borders shared vertex for vertex, as in data/: the
 * edges used in both directions are removed, and the remaining ones are joined into rings.
 * Polygons which do not touch are kept as they are. Returns undefined when the polygons overlap or
 * the edges do not form closed rings, e.g. borders touching without sharing their vertices.
 */
export function dissolvePolygons(polygons: Rings): Rings | undefined {
  const positions = new Map<string, Position>();
  // Net count of the edges between two vertices: +1 per edge lo → hi, -1 per edge hi → lo
  const net = new Map<string, { lo: string; hi: string; count: number }>();
  for (const polygon of polygons) {
    for (const [r, ring] of polygon.entries()) {
      // Outer rings counterclockwise, holes clockwise: the inside is always on the left
      const reversed = signedRingArea(ring) < 0 === (r === 0);
      const n = ring.length - 1;
      for (let i = 0; i < n; i++) {
        let [a, b] = [ring[i]!, ring[i + 1]!];
        if (reversed) [a, b] = [b, a];
        const [ka, kb] = [positionKey(a), positionKey(b)];
        if (ka === kb) continue;
        positions.set(ka, a);
        positions.set(kb, b);
        const [lo, hi] = ka < kb ? [ka, kb] : [kb, ka];
        const key = `${lo}|${hi}`;
        const edge = net.get(key) ?? { lo, hi, count: 0 };
        edge.count += ka === lo ? 1 : -1;
        net.set(key, edge);
      }
    }
  }

  const from: string[] = [];
  const to: string[] = [];
  const outgoing = new Map<string, number[]>();
  for (const { lo, hi, count } of net.values()) {
    if (count === 0) continue;
    // Twice the same edge in the same direction: the polygons overlap
    if (Math.abs(count) > 1) return;
    const [a, b] = count > 0 ? [lo, hi] : [hi, lo];
    let list = outgoing.get(a);
    if (!list) outgoing.set(a, (list = []));
    list.push(from.length);
    from.push(a);
    to.push(b);
  }

  // Join the edges into rings. Where several rings touch at a vertex, take the leftmost turn, so
  // that each ring goes around a single piece of inside.
  const angle = (a: string, b: string) => {
    const [p, q] = [positions.get(a)!, positions.get(b)!];
    return Math.atan2(q[1]! - p[1]!, q[0]! - p[0]!);
  };
  const used = new Uint8Array(from.length);
  const rings: Position[][] = [];
  for (let start = 0; start < from.length; start++) {
    if (used[start]) continue;
    const ring: Position[] = [];
    let edge = start;
    for (;;) {
      used[edge] = 1;
      ring.push(positions.get(from[edge]!)!);
      const vertex = to[edge]!;
      const candidates = (outgoing.get(vertex) ?? []).filter((e) => !used[e] || e === start);
      if (!candidates.length) return;
      let next = candidates[0]!;
      if (candidates.length > 1) {
        const back = angle(vertex, from[edge]!);
        // Clockwise angle from the way back: the smallest is the leftmost turn
        const turn = (e: number) => {
          const d = (back - angle(vertex, to[e]!)) % (2 * Math.PI);
          return d <= 0 ? d + 2 * Math.PI : d;
        };
        for (const e of candidates) if (turn(e) < turn(next)) next = e;
      }
      if (next === start) break;
      edge = next;
    }
    ring.push(ring[0]!);
    if (ring.length >= 4 && signedRingArea(ring) !== 0) rings.push(ring);
  }

  // Counterclockwise rings are outer rings, clockwise ones are holes in the smallest outer ring
  // containing them.
  const outers = rings
    .filter((ring) => signedRingArea(ring) > 0)
    .map((ring) => ({
      area: signedRingArea(ring),
      bbox: ringsBBox([[ring]]),
      keys: new Set(ring.map(positionKey)),
      prepared: preparePolygons([[ring]]),
      polygon: [ring],
    }))
    .sort((a, b) => a.area - b.area);
  for (const hole of rings.filter((ring) => signedRingArea(ring) < 0)) {
    const b = ringsBBox([[hole]]);
    const outer = outers.find((o) => {
      if (b.x0 < o.bbox.x0 || b.x1 > o.bbox.x1 || b.y0 < o.bbox.y0 || b.y1 > o.bbox.y1) return false;
      // A vertex of the hole which is not on the outer ring, if any
      const p = hole.find((v) => !o.keys.has(positionKey(v)));
      return !p || polygonsContain(o.prepared, p[0]!, p[1]!);
    });
    if (!outer) return;
    outer.polygon.push(hole);
  }
  return outers.map((o) => o.polygon);
}

function ringArc(ring: Position[], fromIdx: number, toIdx: number): Position[] {
  const n = ring.length - 1;
  const arc: Position[] = [];
  let curr = fromIdx;
  while (true) {
    arc.push(ring[curr]!);
    if (curr === toIdx) break;
    curr = (curr + 1) % n;
  }
  return arc;
}

export function findClosestVertex(ring: Position[], target: Position): number {
  let bestIdx = 0;
  let bestDistSq = Infinity;
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    const dx = ring[i]![0]! - target[0]!;
    const dy = ring[i]![1]! - target[1]!;
    const d = dx * dx + dy * dy;
    if (d < bestDistSq) {
      bestDistSq = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Merges two rings at two points:
 * goes from Point 2 to Point 1 on Ring A, then bridges to Point 1 on Ring B,
 * goes from Point 1 to Point 2 on Ring B, then bridges back to Point 2 on Ring A.
 * Returns the merged ring, its enclosed area, and all candidate combinations.
 */
export function mergeRingsAtPoints(
  ringA: Position[],
  ringB: Position[],
  p1: Position,
  p2: Position,
  sideIndex = 0,
): { ring: Position[]; area: number; options: Position[][] } | undefined {
  if (ringA.length < 4 || ringB.length < 4) return;
  const idxA1 = findClosestVertex(ringA, p1);
  const idxA2 = findClosestVertex(ringA, p2);
  const idxB1 = findClosestVertex(ringB, p1);
  const idxB2 = findClosestVertex(ringB, p2);
  if (idxA1 === idxA2 || idxB1 === idxB2) return;

  const arcA1 = ringArc(ringA, idxA1, idxA2);
  const arcA2 = ringArc(ringA, idxA2, idxA1);
  const arcB1 = ringArc(ringB, idxB1, idxB2);
  const arcB2 = ringArc(ringB, idxB2, idxB1);

  const candidates: { ring: Position[]; area: number }[] = [];
  function tryJoin(arcA: Position[], arcB: Position[]) {
    const joined = [...arcA];
    for (const p of arcB) {
      const last = joined[joined.length - 1]!;
      if (last[0] !== p[0] || last[1] !== p[1]) joined.push(p);
    }
    const first = joined[0]!;
    const last = joined[joined.length - 1]!;
    if (last[0] !== first[0] || last[1] !== first[1]) joined.push(first);
    if (joined.length >= 4) {
      candidates.push({ ring: joined, area: Math.abs(signedRingArea(joined)) });
    }
  }

  tryJoin(arcA2, arcB1);
  tryJoin(arcA2, [...arcB2].reverse());
  tryJoin(arcA1, arcB2);
  tryJoin(arcA1, [...arcB1].reverse());

  candidates.sort((a, b) => b.area - a.area);
  if (!candidates.length) return;
  const options = candidates.map((c) => c.ring);
  const chosen = options[sideIndex % options.length]!;
  return { ring: chosen, area: Math.abs(signedRingArea(chosen)), options };
}

/**
 * Merges several boundaries into one feature, with the properties of the first feature of the
 * first non-empty boundary. The shared borders are dissolved, see {@link dissolvePolygons}. When they
 * cannot be, the polygons are kept side by side.
 */
export function mergeBoundaries(boundaries: (Boundary | undefined)[]): Boundary | undefined {
  const polygons = boundaries.flatMap((b) => boundaryPolygons(b));
  if (!polygons.length) return;
  let merged = dissolvePolygons(polygons) ?? polygons;
  merged = mergeAdjacentPolygonsWithCommonNodes(merged);
  const properties = boundaries.find((b) => b?.features.length)?.features[0]?.properties ?? {};
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: structuredClone(properties),
        geometry:
          merged.length === 1
            ? { type: "Polygon", coordinates: structuredClone(merged[0]!) }
            : { type: "MultiPolygon", coordinates: structuredClone(merged) },
      },
    ],
  };
}

/**
 * Merges any adjacent polygons that share at least 2 common nodes (shared vertices).
 * Slices the outer rings between the common nodes, dissolving the shared border.
 */
export function mergeAdjacentPolygonsWithCommonNodes(polygons: Rings): Rings {
  let changed = true;
  let current = [...polygons];

  while (changed) {
    changed = false;
    for (let i = 0; i < current.length; i++) {
      for (let j = i + 1; j < current.length; j++) {
        const polyA = current[i]!;
        const polyB = current[j]!;
        const ringA = polyA[0];
        const ringB = polyB[0];
        if (!ringA || !ringB) continue;

        const keysB = new Set(ringB.map(positionKey));
        const shared = ringA.filter((p) => keysB.has(positionKey(p)));
        if (shared.length < 2) continue;

        let bestMerged: Position[] | undefined;
        let maxArea = Math.max(Math.abs(signedRingArea(ringA)), Math.abs(signedRingArea(ringB)));

        const testPoints = [shared[0]!, shared[shared.length - 1]!, shared[Math.floor(shared.length / 2)]!];
        for (let pA = 0; pA < testPoints.length; pA++) {
          for (let pB = pA + 1; pB < testPoints.length; pB++) {
            const res = mergeRingsAtPoints(ringA, ringB, testPoints[pA]!, testPoints[pB]!);
            if (res && res.area > maxArea) {
              maxArea = res.area;
              bestMerged = res.ring;
            }
          }
        }

        if (bestMerged) {
          const newPoly = [bestMerged, ...polyA.slice(1), ...polyB.slice(1)];
          current = current.filter((_, idx) => idx !== i && idx !== j);
          current.push(newPoly);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  return current;
}

/**
 * Merges two boundaries at two specified points:
 * Stitches the closest outer rings at Point 1 and Point 2.
 */
export function mergeBoundariesAtPoints(
  boundaryA: Boundary,
  boundaryB: Boundary,
  p1: Position,
  p2: Position,
  sideIndex = 0,
): { boundary: Boundary; area: number; optionsCount: number } | undefined {
  const polysA = boundaryPolygons(boundaryA);
  const polysB = boundaryPolygons(boundaryB);
  if (!polysA.length || !polysB.length) return;

  const mid: Position = [(p1[0]! + p2[0]!) / 2, (p1[1]! + p2[1]!) / 2];

  function findClosestPoly(polys: Rings): number {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < polys.length; i++) {
      const ring = polys[i]![0]!;
      const idx = findClosestVertex(ring, mid);
      const v = ring[idx]!;
      const dx = v[0]! - mid[0]!,
        dy = v[1]! - mid[1]!;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  const polyIdxA = findClosestPoly(polysA);
  const polyIdxB = findClosestPoly(polysB);
  const polyA = polysA[polyIdxA]!;
  const polyB = polysB[polyIdxB]!;

  const merged = mergeRingsAtPoints(polyA[0]!, polyB[0]!, p1, p2, sideIndex);
  if (!merged) return;

  const mergedPoly: Position[][] = [merged.ring, ...polyA.slice(1), ...polyB.slice(1)];
  const remainingPolys = [...polysA.filter((_, i) => i !== polyIdxA), ...polysB.filter((_, i) => i !== polyIdxB)];
  const allPolys = [mergedPoly, ...remainingPolys];

  const properties = boundaryA.features[0]?.properties ?? boundaryB.features[0]?.properties ?? {};
  const feature: Feature = {
    type: "Feature",
    properties: structuredClone(properties),
    geometry:
      allPolys.length === 1
        ? { type: "Polygon", coordinates: allPolys[0]! }
        : { type: "MultiPolygon", coordinates: allPolys },
  };

  return {
    boundary: { type: "FeatureCollection", features: [feature] },
    area: merged.area,
    optionsCount: merged.options.length,
  };
}

// ---------------------------------------------------------------------------------------------
// Coast simplification
// ---------------------------------------------------------------------------------------------

export interface SimplifyCoastOptions {
  /** Checks if a vertex is shared with neighbouring boundaries */
  isShared: (p: Position) => boolean;
  /** Checks if a coordinate (lon, lat) falls inside any neighbouring region */
  isNeighbourPoint?: (lon: number, lat: number) => boolean;
  /** Distance in degrees to push the rough circling out into the water (default ~0.25° ≈ 28 km) */
  offsetDegrees?: number;
  /** Tolerance in degrees for outer envelope simplification (default ~0.15° ≈ 17 km) */
  tolerance?: number;
}

/** 2D cross product of OA and OB vectors */
function cross2D(o: Position, a: Position, b: Position): number {
  return (a[0]! - o[0]!) * (b[1]! - o[1]!) - (a[1]! - o[1]!) * (b[0]! - o[0]!);
}

/** 2D convex hull via Monotone Chain */
export function ringConvexHull(points: Position[]): Position[] {
  const pts = [...points].sort((a, b) => (a[0] === b[0] ? a[1]! - b[1]! : a[0]! - b[0]!));
  const lower: Position[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross2D(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Position[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!;
    while (upper.length >= 2 && cross2D(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/**
 * Simplifies the coastline of a single outer ring:
 * - Shared borders with neighbouring regions are kept 100% intact.
 * - Coastlines facing water are replaced with a rough outer envelope circling the area in the water.
 * - The new coastline fully encompasses the previous region and avoids neighbouring regions.
 */
export function simplifyRingCoast(
  ring: Position[],
  isShared: (p: Position) => boolean,
  options: SimplifyCoastOptions,
): Position[] {
  const n = ring.length - 1;
  if (n < 4) return ring;

  const offset = options.offsetDegrees ?? 0.25;
  const tolerance = options.tolerance ?? 0.15;
  const isNeighbour = options.isNeighbourPoint ?? (() => false);

  const shared = new Uint8Array(n);
  let sharedCount = 0;
  for (let i = 0; i < n; i++) {
    if (isShared(ring[i]!)) {
      shared[i] = 1;
      sharedCount++;
    }
  }

  // Island case: no shared borders at all
  if (sharedCount === 0) {
    if (n <= 8) return ring;
    const hull = ringConvexHull(ring.slice(0, n));
    let cx = 0;
    let cy = 0;
    for (const p of hull) {
      cx += p[0]!;
      cy += p[1]!;
    }
    cx /= hull.length;
    cy /= hull.length;

    const result = hull.map((p) => {
      const dx = p[0]! - cx;
      const dy = p[1]! - cy;
      const len = Math.hypot(dx, dy) || 1;
      let d = offset;
      while (d > 0.01) {
        const nx = p[0]! + (dx / len) * d;
        const ny = p[1]! + (dy / len) * d;
        if (!isNeighbour(nx, ny)) return [nx, ny];
        d *= 0.5;
      }
      return p;
    });
    result.push([...result[0]!]);
    return result;
  }

  if (sharedCount === n) return ring;

  const isCCW = signedRingArea(ring) > 0;
  const oceanMultiplier = isCCW ? -1 : 1;

  let startIdx = 0;
  while (!shared[startIdx]) startIdx = (startIdx + 1) % n;

  const rot: Position[] = [];
  const rotShared = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const idx = (startIdx + i) % n;
    rot.push(ring[idx]!);
    rotShared[i] = shared[idx]!;
  }
  rot.push(rot[0]!);

  const newRing: Position[] = [];
  let i = 0;
  while (i < n) {
    if (rotShared[i]) {
      newRing.push(rot[i]!);
      i++;
    } else {
      const coastStart = (i - 1 + n) % n;
      let coastEnd = i;
      while (coastEnd < n && !rotShared[coastEnd]) coastEnd++;
      const coastSlice = rot.slice(coastStart, coastEnd + 1);

      const getOuterChain = (pts: Position[], iA: number, iB: number, maxDepth = 4): Position[] => {
        const a = pts[iA]!,
          b = pts[iB]!;
        const lenAB = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!) || 1;
        let maxD = 0;
        let best = -1;
        for (let k = iA + 1; k < iB; k++) {
          const p = pts[k]!;
          const cross = (b[0]! - a[0]!) * (p[1]! - a[1]!) - (b[1]! - a[1]!) * (p[0]! - a[0]!);
          const d = (cross / lenAB) * oceanMultiplier;
          if (d > maxD) {
            maxD = d;
            best = k;
          }
        }
        if (best !== -1 && maxD > tolerance && maxDepth > 0) {
          const left = getOuterChain(pts, iA, best, maxDepth - 1);
          const right = getOuterChain(pts, best, iB, maxDepth - 1);
          return left.slice(0, -1).concat(right);
        }
        return [a, b];
      };

      const chain = getOuterChain(coastSlice, 0, coastSlice.length - 1);

      for (let k = 1; k < chain.length - 1; k++) {
        const prev = chain[k - 1]!;
        const curr = chain[k]!;
        const next = chain[k + 1]!;
        const d1x = curr[0]! - prev[0]!,
          d1y = curr[1]! - prev[1]!;
        const d2x = next[0]! - curr[0]!,
          d2y = next[1]! - curr[1]!;
        const l1 = Math.hypot(d1x, d1y) || 1;
        const l2 = Math.hypot(d2x, d2y) || 1;
        const n1x = isCCW ? d1y / l1 : -d1y / l1;
        const n1y = isCCW ? -d1x / l1 : d1x / l1;
        const n2x = isCCW ? d2y / l2 : -d2y / l2;
        const n2y = isCCW ? -d2x / l2 : d2x / l2;
        let bix = (n1x + n2x) / 2;
        let biy = (n1y + n2y) / 2;
        const biLen = Math.hypot(bix, biy) || 1;
        bix /= biLen;
        biy /= biLen;

        let d = offset;
        while (d > 0.01) {
          const px = curr[0]! + bix * d;
          const py = curr[1]! + biy * d;
          if (!isNeighbour(px, py)) {
            chain[k] = [px, py];
            break;
          }
          d *= 0.5;
        }
      }

      for (let k = 1; k < chain.length - 1; k++) {
        newRing.push(chain[k]!);
      }
      i = coastEnd;
    }
  }
  newRing.push(newRing[0]!);
  return newRing;
}

/**
 * Simplifies the coasts of a boundary:
 * - Shared borders with neighbouring boundaries are kept 100% intact.
 * - Coastlines facing the sea are roughly circled into the water.
 * - Fully encompasses the original region and does not cross neighbouring regions.
 */
export function simplifyCoast(boundary: Boundary, options: SimplifyCoastOptions): Boundary {
  const simplifyRings = (rings: Position[][]) => {
    if (!rings.length) return rings;
    const outer = simplifyRingCoast(rings[0]!, options.isShared, options);
    return [outer, ...rings.slice(1)];
  };

  return {
    ...boundary,
    features: boundary.features.map((feature) => {
      const geometry = feature.geometry;
      if (geometry?.type === "Polygon") {
        const coordinates = simplifyRings(geometry.coordinates);
        return { ...feature, geometry: { type: "Polygon", coordinates } };
      }
      if (geometry?.type === "MultiPolygon") {
        const coordinates = geometry.coordinates.map(simplifyRings);
        return { ...feature, geometry: { type: "MultiPolygon", coordinates } };
      }
      return feature;
    }),
  };
}
