import type { Position } from "geojson";
import type { ClimbingPoint, ClimbingPointKind } from "@climbhub/climbing-data-gen";
import { BOUNDARY_EXTENSION } from "@climbhub/reverse-geocoding-data/shared";

import {
  addPolygon,
  bboxContains,
  bboxIntersects,
  boundaryPolygons,
  cloneBoundary,
  countVertices,
  emptyBBox,
  isEmptyBBox,
  mergeBBox,
  mergeBoundaries,
  mergeBoundariesAtPoints,
  polygonsContain,
  positionKey,
  preparePolygons,
  removeVertices,
  ringsBBox,
  sharedVertexIndex,
  simplifyBoundary,
  simplifyCoast,
  toBoundary,
  type BBox,
  type PreparedPolygon,
} from "./geometry";
import type { Boundary, BoundaryState, BoundaryStates, DataFiles } from "./types";

/**
 * A region. Leaves have a boundary, saved as data/<path>.geojson. The other regions are
 * directories, without a boundary.
 */
export interface EditorNode {
  id: number;
  slug: string;
  path?: string;
  parent?: EditorNode;
  children: EditorNode[];
  boundary?: Boundary;
  /** Text of the boundary file it was loaded from: written back as is when not modified */
  raw?: string;
  /** The boundary was modified since it was loaded from `raw` */
  dirty: boolean;
  /** Bumped when the boundary of the node or of a descendant changes: a key for caches */
  revision: number;

  // Caches, updated by `updateGeometryCache`
  prepared: PreparedPolygon[];
  ownBBox: BBox;
  /** Own bbox merged with the children ones, as `_bbox` in hierarchy-index.json */
  bbox: BBox;
  vertexCount: number;
  /** Size of the boundary file, in bytes */
  size: number;

  // Statistics, updated by `recomputeStats`
  /** Climbing places geolocated in this node or its descendants */
  total: number;
  /** Climbing places geolocated in this node itself, not a child */
  own: number;
  /** Climbing places of the subtree inside several overlapping siblings */
  ambiguous: number;
  kinds: Record<ClimbingPointKind, number>;
}

/** Above this, the vertices are not displayed on the map: simplify the boundary first */
export const MAX_EDITABLE_VERTICES = 30000;

export const KINDS: ClimbingPointKind[] = ["crag", "area", "boulder", "gym", "other"];

/** Status of a climbing place, as displayed on the map */
export const PointStatus = {
  Assigned: 0,
  /** Not inside any boundary: the pipeline will drop it */
  Unassigned: 1,
  /** Inside several sibling boundaries: the first one alphabetically wins */
  Ambiguous: 2,
} as const;

interface UndoEntry {
  label: string;
  nodes: { node: EditorNode; boundary?: Boundary; raw?: string; dirty: boolean }[];
  /** Nodes removed by the operation, put back in their parent by the undo */
  removed?: EditorNode[];
  /** Newly created nodes, detached by the undo */
  created?: EditorNode[];
  /** Node renamed by the operation, with its previous slug */
  renamed?: { node: EditorNode; slug: string };
}

/** The borders of a leaf with the sea (no region on the other side), see {@link EditorStore.findCoasts} */
export interface CoastInfo {
  /** Of the node when it was measured: outdated once it changes */
  revision: number;
  /** In km */
  length: number;
  /** Number of vertices on these borders */
  vertices: number;
}

/** Above this many vertices per km, a coast is more precise than needed: nothing is in the sea */
export const PRECISE_COAST_DENSITY = 1 / 10;
/** Shorter coasts are not reported */
const MIN_COAST_KM = 10;

export function isPreciseCoast(node: EditorNode, coast: CoastInfo | undefined): coast is CoastInfo {
  return (
    !!coast &&
    coast.revision === node.revision &&
    coast.length >= MIN_COAST_KM &&
    coast.vertices / coast.length > PRECISE_COAST_DENSITY
  );
}

/** What changed in data/ */
export interface DataChanges {
  /** Path in data/ → new content */
  write: Map<string, string>;
  delete: string[];
}

function emptyKinds(): Record<ClimbingPointKind, number> {
  return { crag: 0, area: 0, boulder: 0, gym: 0, other: 0 };
}

/** Same order as `readdirSync`, used by the pipeline: the first matching sibling wins */
function bySlug(a: EditorNode, b: EditorNode) {
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}

export function nodePath(node: EditorNode): string {
  return node.path ?? (node.parent ? `${nodePath(node.parent)}/${node.slug}` : node.slug);
}

/** Path of the boundary file in data/ */
export function nodeFile(node: EditorNode): string {
  return (node.path ?? nodePath(node)) + BOUNDARY_EXTENSION;
}

/**
 * Name of a region. The path is the key of its translation.
 * TODO: translate it with wuchale. Until then, the slug is displayed.
 */
export function nodeName(node: EditorNode): string {
  return node.slug;
}

/** Name of the OSM feature of the boundary, if any. A hint for the slug. */
export function osmName(node: EditorNode): string | undefined {
  const properties = node.boundary?.features[0]?.properties;
  return properties?.official_name || properties?.name;
}

/** Only leaves are saved, and only when they have a boundary */
export function hasFile(node: EditorNode) {
  return node.children.length === 0 && !!node.boundary?.features.length;
}

export function isAncestor(ancestor: EditorNode, node: EditorNode | undefined): boolean {
  for (let n = node?.parent; n; n = n.parent) if (n === ancestor) return true;
  return false;
}

export function* walk(node: EditorNode): Generator<EditorNode> {
  yield node;
  for (const child of node.children) yield* walk(child);
}

interface DraftNode {
  children: Map<string, DraftNode>;
  raw?: string;
}

/** Builds the tree of regions from the files of data/ */
function buildTree(files: DataFiles): DraftNode {
  const root: DraftNode = { children: new Map() };
  for (const [path, raw] of Object.entries(files)) {
    if (!path.startsWith("world/") || !path.endsWith(BOUNDARY_EXTENSION)) continue;
    let draft = root;
    for (const segment of path.slice(0, -BOUNDARY_EXTENSION.length).split("/")) {
      let child = draft.children.get(segment);
      if (!child) draft.children.set(segment, (child = { children: new Map() }));
      draft = child;
    }
    draft.raw = raw;
  }
  return root.children.get("world") ?? { children: new Map() };
}

export class EditorStore {
  /** Bumped on every change. Read it in a $derived to react to changes of the (non reactive) tree. */
  version = $state(0);
  selected = $state.raw<EditorNode | undefined>();
  /** Nodes whose vertices are being edited on the map */
  editing = $state(false);
  /** Move the vertices shared with the neighbouring boundaries together */
  linkVertices = $state(true);
  /** Leaves to merge into the selected node, picked with Ctrl+click in the tree or on the map */
  mergeSelection = $state.raw(new Set<EditorNode>());
  /** Whether the interactive merge mode is active on the map */
  mergeMode = $state(false);
  /** When merging at 2 points, which arc connection option to use */
  mergeSideIndex = $state(0);
  /** Git states reported by the local development server */
  gitStates = $state.raw<BoundaryStates>({});
  /** Vertices of the selected node selected on the map, by {@link positionKey} */
  vertexSelection = $state.raw(new Map<string, Position>());
  /** Leaves with more climbing places than this should probably be subdivided */
  threshold = $state(150);
  /** Preview of an operation (simplification, query result...), drawn on top of the map */
  preview = $state.raw<Boundary | undefined>();
  undoStack = $state.raw<UndoEntry[]>([]);
  /** Content of data/ when it was loaded or last saved. Changes are relative to it. */
  saved: DataFiles;
  /** Bumped when the climbing places are replaced */
  pointsVersion = $state(0);

  selectedAncestorIds = $derived.by(() => {
    const set = new Set<number>();
    for (let n = this.selected?.parent; n; n = n.parent) set.add(n.id);
    return set;
  });

  root: EditorNode;
  nodesById = new Map<number, EditorNode>();

  // Climbing places, as flat arrays for speed
  points: ClimbingPoint[] = [];
  lon = new Float64Array();
  lat = new Float64Array();
  /** Id of the node each point is geolocated in, -1 if none */
  assignment = new Int32Array();
  status = new Uint8Array();
  /** Called with the indexes of the points whose status changed */
  onPointsChanged?: (indexes: number[]) => void;

  private nextId = 0;
  private unassignedIndices = new Set<number>();
  private ambiguousIndices = new Set<number>();
  private stateCache = new WeakMap<
    EditorNode,
    { revision: number; gitVersion: number; dirty: boolean; raw?: string; state: BoundaryState }
  >();
  private gitVersion = 0;
  private cachedModifiedCount?: { version: number; count: number };

  constructor(files: DataFiles, points: ClimbingPoint[]) {
    this.saved = files;
    this.root = this.importNode("world", buildTree(files));
    this.updateBBoxes(this.root);
    this.setPoints(points);
  }

  private importNode(slug: string, draft: DraftNode, parent?: EditorNode): EditorNode {
    const node = this.createNode(slug, parent);
    if (draft.raw !== undefined) {
      node.raw = draft.raw;
      try {
        node.boundary = toBoundary(JSON.parse(draft.raw));
      } catch (e) {
        console.error(`Invalid boundary ${nodeFile(node)}`, e);
      }
    }
    node.children = [...draft.children]
      .map(([childSlug, child]) => this.importNode(childSlug, child, node))
      .sort(bySlug);
    this.updateGeometryCache(node);
    return node;
  }

  private createNode(slug: string, parent: EditorNode | undefined) {
    const node: EditorNode = {
      id: this.nextId++,
      slug,
      path: parent ? `${parent.path ?? nodePath(parent)}/${slug}` : slug,
      parent,
      children: [],
      dirty: false,
      revision: 0,
      prepared: [],
      ownBBox: emptyBBox(),
      bbox: emptyBBox(),
      vertexCount: 0,
      size: 0,
      total: 0,
      own: 0,
      ambiguous: 0,
      kinds: emptyKinds(),
    };
    this.nodesById.set(node.id, node);
    return node;
  }

  private updateNodePaths(node: EditorNode) {
    node.path = node.parent ? `${node.parent.path ?? nodePath(node.parent)}/${node.slug}` : node.slug;
    for (const child of node.children) this.updateNodePaths(child);
  }

  private updateGeometryCache(node: EditorNode) {
    const polygons = boundaryPolygons(node.boundary);
    node.revision++;
    node.prepared = preparePolygons(polygons);
    node.ownBBox = ringsBBox(polygons);
    node.vertexCount = countVertices(node.boundary);
    node.size = !node.boundary
      ? 0
      : !node.dirty && node.raw !== undefined
        ? node.raw.length
        : JSON.stringify(node.boundary).length;
  }

  /** Recomputes the bboxes of the subtree */
  private updateBBoxes(node: EditorNode): BBox {
    node.bbox = node.children.reduce((b, child) => mergeBBox(b, this.updateBBoxes(child)), {
      ...node.ownBBox,
    });
    return node.bbox;
  }

  /** Recomputes the bboxes of the node and its ancestors */
  private updateAncestorBBoxes(node: EditorNode) {
    for (let n: EditorNode | undefined = node; n; n = n.parent) {
      n.bbox = n.children.reduce((b, child) => mergeBBox(b, child.bbox), { ...n.ownBBox });
      n.revision++;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Geolocation of the climbing places, mirroring ReverseGeolocator of @climbhub/climbing-data-gen
  // ---------------------------------------------------------------------------------------------

  setPoints(points: ClimbingPoint[]) {
    this.points = points;
    this.lon = Float64Array.from(points, (p) => p.lon);
    this.lat = Float64Array.from(points, (p) => p.lat);
    this.assignment = new Int32Array(points.length).fill(-1);
    this.status = new Uint8Array(points.length);
    this.recompute();
    this.pointsVersion++;
    this.version++;
  }

  private geolocate(node: EditorNode, lon: number, lat: number): EditorNode | undefined {
    if (!bboxContains(node.bbox, lon, lat)) return;
    for (const child of node.children) {
      const matched = this.geolocate(child, lon, lat);
      if (matched) return matched;
    }
    if (polygonsContain(node.prepared, lon, lat)) return node;
  }

  /** Whether the point is inside several siblings along its geolocation path */
  private isAmbiguous(assigned: EditorNode, lon: number, lat: number) {
    for (let n: EditorNode | undefined = assigned; n?.parent; n = n.parent) {
      for (const sibling of n.parent.children) {
        if (sibling !== n && this.geolocate(sibling, lon, lat)) return true;
      }
    }
    return false;
  }

  /** Geolocates again the points inside `area`, or all of them. */
  recompute(area?: BBox) {
    let changed = 0;
    const changedStatus: number[] = [];

    for (let i = 0; i < this.points.length; i++) {
      const lon = this.lon[i]!,
        lat = this.lat[i]!;
      if (area && !bboxContains(area, lon, lat)) continue;

      const oldNodeId = this.assignment[i]!;
      const oldStatus = this.status[i]!;
      const node = this.geolocate(this.root, lon, lat);
      const newNodeId = node ? node.id : -1;
      const newStatus = !node
        ? PointStatus.Unassigned
        : this.isAmbiguous(node, lon, lat)
          ? PointStatus.Ambiguous
          : PointStatus.Assigned;

      if (oldNodeId !== newNodeId || oldStatus !== newStatus) {
        changed++;
        this.assignment[i] = newNodeId;
        this.status[i] = newStatus;
        if (oldStatus !== newStatus) {
          changedStatus.push(i);
          if (oldStatus === PointStatus.Unassigned) this.unassignedIndices.delete(i);
          else if (oldStatus === PointStatus.Ambiguous) this.ambiguousIndices.delete(i);
          if (newStatus === PointStatus.Unassigned) this.unassignedIndices.add(i);
          else if (newStatus === PointStatus.Ambiguous) this.ambiguousIndices.add(i);
        }
      } else if (!area) {
        if (newStatus === PointStatus.Unassigned) this.unassignedIndices.add(i);
        else if (newStatus === PointStatus.Ambiguous) this.ambiguousIndices.add(i);
      }
    }

    if (area && changed === 0) return;

    this.recomputeStats();
    if (changedStatus.length) this.onPointsChanged?.(changedStatus);
  }

  private recomputeStats() {
    for (const node of this.nodesById.values()) {
      node.total = node.own = node.ambiguous = 0;
      node.kinds.crag = node.kinds.area = node.kinds.boulder = node.kinds.gym = node.kinds.other = 0;
    }
    for (let i = 0; i < this.points.length; i++) {
      const node = this.nodesById.get(this.assignment[i]!);
      if (!node) continue;
      node.own++;
      node.kinds[this.points[i]!.kind]++;
      if (this.status[i] === PointStatus.Ambiguous) node.ambiguous++;
    }
    // Bottom-up aggregate to ancestors
    const aggregate = (node: EditorNode) => {
      node.total = node.own;
      for (const child of node.children) {
        aggregate(child);
        node.total += child.total;
        node.ambiguous += child.ambiguous;
        for (const k of KINDS) node.kinds[k] += child.kinds[k];
      }
    };
    aggregate(this.root);
  }

  get unassignedCount() {
    return this.unassignedIndices.size;
  }

  get ambiguousCount() {
    return this.ambiguousIndices.size;
  }

  /** Unassigned points inside a bbox */
  unassignedIn(b: BBox) {
    if (this.unassignedIndices.size === 0) return 0;
    let count = 0;
    for (const i of this.unassignedIndices) {
      if (bboxContains(b, this.lon[i]!, this.lat[i]!)) count++;
    }
    return count;
  }

  // ---------------------------------------------------------------------------------------------
  // Coasts
  // ---------------------------------------------------------------------------------------------

  /** Of the leaves, by node */
  coasts = $state.raw(new Map<EditorNode, CoastInfo>());

  /**
   * Measures the coast of a leaf: its segments with no region at about 1 km on their outer side.
   * At most `samples` segments are tested, the result is extrapolated.
   */
  measureCoast(node: EditorNode, samples = 300): CoastInfo {
    const offset = 0.01;
    let segments = 0;
    for (const polygon of boundaryPolygons(node.boundary))
      for (const ring of polygon) segments += ring.length - 1;
    const step = Math.max(1, Math.floor(segments / samples));
    let length = 0;
    let vertices = 0;
    let index = 0;
    for (const polygon of boundaryPolygons(node.boundary)) {
      for (const ring of polygon) {
        for (let i = 0; i + 1 < ring.length; i++, index++) {
          if (index % step) continue;
          const [x0, y0] = ring[i]!;
          const [x1, y1] = ring[i + 1]!;
          const k = Math.cos((((y0! + y1!) / 2) * Math.PI) / 180);
          const dx = (x1! - x0!) * k;
          const dy = y1! - y0!;
          const d = Math.hypot(dx, dy);
          if (!d) continue;
          // Perpendicular, at `offset` degrees of latitude from the middle of the segment
          const [mx, my] = [(x0! + x1!) / 2, (y0! + y1!) / 2];
          const [nx, ny] = [((-dy / d) * offset) / k, (dx / d) * offset];
          const side = polygonsContain(node.prepared, mx + nx, my + ny) ? -1 : 1;
          if (this.geolocate(this.root, mx + side * nx, my + side * ny)) continue;
          length += d * 111.2 * step;
          vertices += step;
        }
      }
    }
    return { revision: node.revision, length, vertices };
  }

  /** Measures the coasts of the leaves of `node`, in slices so that the page stays responsive */
  async findCoasts(node: EditorNode, onProgress?: (done: number, total: number) => void) {
    const leaves = [...walk(node)].filter((n) => !n.children.length && n.boundary);
    const coasts = new Map(this.coasts);
    let last = performance.now();
    for (const [i, leaf] of leaves.entries()) {
      coasts.set(leaf, this.measureCoast(leaf));
      if (performance.now() - last > 50) {
        onProgress?.(i + 1, leaves.length);
        await new Promise((r) => setTimeout(r));
        last = performance.now();
      }
    }
    this.coasts = coasts;
    return leaves.filter((leaf) => isPreciseCoast(leaf, coasts.get(leaf)));
  }

  // ---------------------------------------------------------------------------------------------
  // Geometry edits
  // ---------------------------------------------------------------------------------------------

  private pushUndo(
    label: string,
    nodes: EditorNode[],
    removed?: EditorNode[],
    created?: EditorNode[],
  ) {
    const entry: UndoEntry = {
      label,
      removed,
      created,
      nodes: nodes.map((node) => ({
        node,
        boundary: cloneBoundary(node.boundary),
        raw: node.raw,
        dirty: node.dirty,
      })),
    };
    this.undoStack = [...this.undoStack.slice(-49), entry];
  }

  /**
   * Call before modifying the boundaries of `nodes` in place, then call the returned function
   * once done. Used by the vertex dragging, which modifies the boundaries continuously.
   * `removed` are the nodes of `nodes` that the operation removes from the tree.
   * `created` are newly created nodes to be detached on undo.
   */
  beginEdit(
    label: string,
    nodes: EditorNode[],
    removed?: EditorNode[],
    created?: EditorNode[],
  ) {
    this.pushUndo(label, nodes, removed, created);
    const before = nodes.map((n) => ({ ...n.ownBBox }));
    return () => this.afterEdit(nodes, before);
  }

  private afterEdit(nodes: EditorNode[], before: BBox[]) {
    let area = emptyBBox();
    nodes.forEach((node, i) => {
      node.dirty = true;
      area = mergeBBox(area, before[i]!);
      this.updateGeometryCache(node);
      area = mergeBBox(area, node.ownBBox);
      this.updateAncestorBBoxes(node);
    });
    if (!isEmptyBBox(area)) this.recompute(area);
    this.version++;
  }

  setBoundary(node: EditorNode, boundary: Boundary | undefined, label: string) {
    const done = this.beginEdit(label, [node]);
    node.boundary = boundary;
    done();
  }

  undo() {
    const entry = this.undoStack.at(-1);
    if (!entry) return;
    for (const node of entry.removed ?? []) {
      if (node.parent!.children.some((c) => c.slug === node.slug)) {
        throw new Error(`Cannot undo: ${nodePath(node)} exists again`);
      }
    }
    this.undoStack = this.undoStack.slice(0, -1);
    if (entry.renamed) {
      const { node, slug } = entry.renamed;
      if (node.parent?.children.some((c) => c !== node && c.slug === slug)) {
        this.undoStack = [...this.undoStack, entry];
        throw new Error(`Cannot undo: ${nodePath(node.parent)}/${slug} exists again`);
      }
      this.setSlug(node, slug);
    }
    for (const node of entry.created ?? []) {
      this.detach(node, false);
    }
    for (const node of entry.removed ?? []) {
      for (const n of walk(node)) this.nodesById.set(n.id, n);
      node.parent!.children.push(node);
      node.parent!.children.sort(bySlug);
      this.updateNodePaths(node);
    }
    let area = emptyBBox();
    for (const { node, boundary, raw, dirty } of entry.nodes) {
      area = mergeBBox(area, node.ownBBox);
      node.boundary = boundary;
      node.raw = raw;
      node.dirty = dirty;
      this.updateGeometryCache(node);
      area = mergeBBox(area, node.ownBBox);
      this.updateAncestorBBoxes(node);
    }
    if (!isEmptyBBox(area)) this.recompute(area);
    this.version++;
  }

  /**
   * Removes the vertices at `positions` from the node, and from its neighbours when the vertices
   * are linked. Rings left with fewer than 3 vertices are removed.
   */
  removeVertices(node: EditorNode, positions: Position[]) {
    if (!node.boundary || !positions.length) return;
    const keys = new Set(positions.map(positionKey));
    const area = positions.reduce(
      (b, [x, y]) => mergeBBox(b, { x0: x!, x1: x!, y0: y!, y1: y! }),
      emptyBBox(),
    );
    const candidates = [node, ...(this.linkVertices ? this.neighbours(node, area) : [])];
    const targets = candidates.filter((n) =>
      boundaryPolygons(n.boundary).some((polygon) =>
        polygon.some((ring) => ring.some((p) => keys.has(positionKey(p)))),
      ),
    );
    const done = this.beginEdit(
      positions.length > 1 ? `Remove ${positions.length} vertices` : "Remove vertex",
      targets,
    );
    for (const target of targets) {
      removeVertices(target.boundary!, keys);
      if (!target.boundary!.features.length) target.boundary = undefined;
    }
    done();
  }

  /** Adds a polygon to the boundary of a leaf */
  addPolygon(node: EditorNode, ring: Position[]) {
    const done = this.beginEdit("Add polygon", [node]);
    node.boundary = addPolygon(node.boundary, ring);
    done();
  }

  /**
   * Splits a leaf in two: it keeps `kept`, and a new sibling named `slug` gets `part`.
   * See {@link splitBoundary}.
   */
  split(node: EditorNode, kept: Boundary, part: Boundary, slug: string) {
    const parent = node.parent;
    if (!parent) throw new Error("The world cannot be split");
    if (parent.children.some((c) => c.slug === slug)) {
      throw new Error(`${nodePath(parent)}/${slug} already exists`);
    }
    const sibling = this.createNode(slug, parent);
    parent.children.push(sibling);
    parent.children.sort(bySlug);
    const done = this.beginEdit("Split", [node, sibling]);
    node.boundary = kept;
    sibling.boundary = part;
    done();
    return sibling;
  }

  /**
   * Merges the leaves `others` into the leaf `node`, which keeps its slug and the properties of
   * its boundary. The others are removed. See {@link mergeBoundaries}.
   */
  merge(node: EditorNode, others: EditorNode[]) {
    others = [...new Set(others)].filter((n) => n !== node);
    if (!others.length) return;
    if ([node, ...others].some((n) => n.children.length || !n.parent)) {
      throw new Error("Only leaves can be merged");
    }
    const done = this.beginEdit(`Merge ${others.length + 1} regions`, [node, ...others], others);
    node.boundary = mergeBoundaries([node.boundary, ...others.map((n) => n.boundary)]);
    // Keep the undo entry, which puts them back
    for (const other of others) this.detach(other, false);
    this.mergeSelection = new Set();
    done();
  }

  /**
   * Merges multiple leaves into a new region named `slug` under `parent`.
   * The original leaves are removed. Shared borders between them are dissolved.
   */
  mergeIntoNew(parent: EditorNode, slug: string, nodes: EditorNode[], name?: string): EditorNode {
    nodes = [...new Set(nodes)];
    if (nodes.length < 2) throw new Error("At least two regions must be selected to merge");
    if (nodes.some((n) => n.children.length || !n.parent)) {
      throw new Error("Only leaves can be merged");
    }
    if (parent.children.some((c) => c.slug === slug)) {
      throw new Error(`A region named ${slug} already exists in ${nodeName(parent)}`);
    }

    const mergedBoundary = mergeBoundaries(nodes.map((n) => n.boundary));
    if (!mergedBoundary) throw new Error("Could not merge boundaries");

    if (name && mergedBoundary.features[0]) {
      mergedBoundary.features[0].properties = {
        ...mergedBoundary.features[0].properties,
        name,
      };
    }

    const newNode = this.createNode(slug, parent);
    parent.children.push(newNode);
    parent.children.sort(bySlug);

    const done = this.beginEdit(
      `Merge ${nodes.length} regions into ${slug}`,
      [newNode, ...nodes],
      nodes,
      [newNode],
    );

    newNode.boundary = mergedBoundary;
    for (const node of nodes) this.detach(node, false);
    this.mergeSelection = new Set();
    this.selected = newNode;
    done();
    return newNode;
  }

  /**
   * Merges two leaves at two specified points.
   * Traverses from point 2 to point 1 on Shape A, bridges to Shape B at point 1,
   * traverses Shape B to point 2, and bridges back to Shape A at point 2.
   */
  mergeAtPoints(
    nodeA: EditorNode,
    nodeB: EditorNode,
    p1: Position,
    p2: Position,
    sideIndex = 0,
    target: "new" | "A" | "B" = "A",
    newSlug?: string,
    newName?: string,
  ): EditorNode {
    if (!nodeA.boundary || !nodeB.boundary) throw new Error("Both nodes must have boundaries");
    const res = mergeBoundariesAtPoints(nodeA.boundary, nodeB.boundary, p1, p2, sideIndex);
    if (!res) throw new Error("Could not merge boundaries at the given 2 points");

    if (target === "new") {
      const parent = nodeA.parent ?? this.root;
      const slug = newSlug || `${nodeA.slug}-${nodeB.slug}`;
      if (parent.children.some((c) => c.slug === slug && c !== nodeA && c !== nodeB)) {
        throw new Error(`A region named ${slug} already exists in ${nodeName(parent)}`);
      }
      const newNode = this.createNode(slug, parent);
      parent.children.push(newNode);
      parent.children.sort(bySlug);

      const done = this.beginEdit(
        `Merge 2 regions at 2 points into ${slug}`,
        [newNode, nodeA, nodeB],
        [nodeA, nodeB],
        [newNode],
      );
      newNode.boundary = res.boundary;
      if (newName && newNode.boundary.features[0]) {
        newNode.boundary.features[0].properties = {
          ...newNode.boundary.features[0].properties,
          name: newName,
        };
      }
      this.detach(nodeA, false);
      this.detach(nodeB, false);
      this.mergeSelection = new Set();
      this.vertexSelection = new Map();
      this.selected = newNode;
      done();
      return newNode;
    } else {
      const keep = target === "A" ? nodeA : nodeB;
      const remove = target === "A" ? nodeB : nodeA;
      const done = this.beginEdit(
        `Merge ${remove.slug} into ${keep.slug} at 2 points`,
        [keep, remove],
        [remove],
      );
      keep.boundary = res.boundary;
      this.detach(remove, false);
      this.mergeSelection = new Set();
      this.vertexSelection = new Map();
      this.selected = keep;
      done();
      return keep;
    }
  }

  clearMergeSelection() {
    this.mergeSelection = new Set();
  }

  setMergeSelection(nodes: Iterable<EditorNode>) {
    this.mergeSelection = new Set(nodes);
  }

  /** Nodes whose boundaries may share vertices with `node`: everything except its ancestors and descendants. */
  neighbours(node: EditorNode, area: BBox): EditorNode[] {
    const result: EditorNode[] = [];
    for (const other of this.nodesById.values()) {
      if (other === node || !other.boundary) continue;
      if (isAncestor(other, node) || isAncestor(node, other)) continue;
      if (bboxIntersects(other.ownBBox, area)) result.push(other);
    }
    return result;
  }

  /**
   * Simplifies the boundaries of `nodes`. Shared borders between them stay shared. When
   * `lockNeighbours` is set, the vertices shared with boundaries outside of `nodes` are kept,
   * so that no gap appears with them.
   */
  simplified(nodes: EditorNode[], tolerance: number, lockNeighbours: boolean) {
    const withBoundary = nodes.filter((n) => n.boundary);
    const area = withBoundary.reduce((b, n) => mergeBBox(b, n.ownBBox), emptyBBox());
    const group = new Set(withBoundary);
    const neighbours = new Set<EditorNode>();
    for (const node of withBoundary) {
      for (const n of this.neighbours(node, area)) if (!group.has(n)) neighbours.add(n);
    }

    const index = sharedVertexIndex(
      [...group, ...neighbours].map((n) => ({ id: String(n.id), boundary: n.boundary! })),
    );
    const groupIds = new Set([...group].map((n) => String(n.id)));
    const sharers = (p: Position) => [...(index.get(positionKey(p)) ?? [])].sort().join(",");
    const locked = (p: Position) => {
      if (!lockNeighbours) return false;
      for (const id of index.get(positionKey(p)) ?? []) if (!groupIds.has(id)) return true;
      return false;
    };

    return withBoundary.map((node) => ({
      node,
      boundary: simplifyBoundary(node.boundary!, { tolerance, sharers, locked }),
    }));
  }

  applySimplification(result: { node: EditorNode; boundary: Boundary }[]) {
    const done = this.beginEdit(
      "Simplify",
      result.map((r) => r.node),
    );
    for (const { node, boundary } of result) node.boundary = boundary;
    done();
  }

  /**
   * Simplifies the coasts of `nodes`: replaces coastlines facing the sea with a rough circling
   * in the water that fully encompasses the original region, while keeping borders with
   * neighbouring regions 100% intact and not overlapping any neighbour.
   */
  simplifiedCoasts(
    nodes: EditorNode[],
    options: { tolerance?: number; offsetDegrees?: number } = {},
  ) {
    const withBoundary = nodes.filter((n) => n.boundary);
    const area = withBoundary.reduce((b, n) => mergeBBox(b, n.ownBBox), emptyBBox());
    const group = new Set(withBoundary);
    const neighbours = new Set<EditorNode>();
    for (const node of withBoundary) {
      for (const n of this.neighbours(node, area)) if (!group.has(n)) neighbours.add(n);
    }

    const index = sharedVertexIndex(
      [...group, ...neighbours].map((n) => ({ id: String(n.id), boundary: n.boundary! })),
    );
    const neighbourList = [...neighbours].filter((n) => n.prepared?.length);

    return withBoundary.map((node) => {
      const isShared = (p: Position) => {
        const sharers = index.get(positionKey(p));
        if (!sharers) return false;
        if (sharers.size > 1) return true;
        return !sharers.has(String(node.id));
      };
      const isNeighbourPoint = (lon: number, lat: number) => {
        return neighbourList.some((n) => polygonsContain(n.prepared, lon, lat));
      };
      return {
        node,
        boundary: simplifyCoast(node.boundary!, {
          isShared,
          isNeighbourPoint,
          tolerance: options.tolerance,
          offsetDegrees: options.offsetDegrees,
        }),
      };
    });
  }

  applyCoastSimplification(result: { node: EditorNode; boundary: Boundary }[]) {
    const done = this.beginEdit(
      "Simplify coast",
      result.map((r) => r.node),
    );
    for (const { node, boundary } of result) node.boundary = boundary;
    done();
  }


  // ---------------------------------------------------------------------------------------------
  // Structure and configuration edits
  // ---------------------------------------------------------------------------------------------

  /**
   * Adds a leaf. Only leaves have a boundary: the boundary of the parent is removed, and
   * `boundary` can be the one of the parent.
   */
  addChild(parent: EditorNode, slug: string, boundary?: Boundary) {
    if (parent.children.some((c) => c.slug === slug)) {
      throw new Error(`${nodePath(parent)}/${slug} already exists`);
    }
    const node = this.createNode(slug, parent);
    parent.children.push(node);
    parent.children.sort(bySlug);
    const done = this.beginEdit("Add child", [parent, node]);
    parent.boundary = undefined;
    node.boundary = boundary;
    done();
    return node;
  }

  /** Renames the node: its file, or the directory of its descendants, moves in data/ */
  rename(node: EditorNode, slug: string) {
    const parent = node.parent;
    if (!parent) throw new Error("The world cannot be renamed");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
      throw new Error(`Invalid slug "${slug}": a-z, 0-9 and -`);
    if (slug === node.slug) return;
    if (parent.children.some((c) => c.slug === slug)) {
      throw new Error(`${nodePath(parent)}/${slug} already exists`);
    }
    this.undoStack = [
      ...this.undoStack.slice(-49),
      { label: `Rename ${node.slug} to ${slug}`, nodes: [], renamed: { node, slug: node.slug } },
    ];
    this.setSlug(node, slug);
  }

  private setSlug(node: EditorNode, slug: string) {
    node.slug = slug;
    this.updateNodePaths(node);
    node.parent!.children.sort(bySlug);
    this.updateAncestorBBoxes(node);
    // The geolocation depends on the order of the siblings
    this.recompute(node.parent!.bbox);
    this.version++;
  }

  removeNode(node: EditorNode) {
    this.detach(node);
    this.recompute();
    this.version++;
  }

  private detach(node: EditorNode, dropUndo = true) {
    const parent = node.parent;
    if (!parent) return;
    for (const n of walk(node)) this.nodesById.delete(n.id);
    parent.children = parent.children.filter((c) => c !== node);
    this.updateAncestorBBoxes(parent);
    if (this.selected && (this.selected === node || isAncestor(node, this.selected))) {
      this.selected = parent;
    }
    if (this.mergeSelection.has(node)) {
      this.mergeSelection = new Set([...this.mergeSelection].filter((n) => n !== node));
    }
    if (!dropUndo) return;
    // The entries removing nodes put them back: they stay valid while their parents exist
    this.undoStack = this.undoStack.filter((e) =>
      e.nodes.every((n) =>
        e.removed?.includes(n.node)
          ? this.nodesById.has(n.node.parent!.id)
          : this.nodesById.has(n.node.id),
      ),
    );
  }

  /** Adds or removes a leaf from {@link mergeSelection} */
  toggleMerge(node: EditorNode) {
    const selection = new Set(this.mergeSelection);
    if (!selection.delete(node)) selection.add(node);
    this.mergeSelection = selection;
  }

  /**
   * Applies the result of a query returning several regions: they become the children of
   * `parent`, which loses its own boundary. Existing children with the same slug are replaced.
   */
  applySubdivisions(parent: EditorNode, children: Map<string, Boundary>) {
    const existing = new Map(parent.children.map((c) => [c.slug, c]));
    const nodes: EditorNode[] = [];
    let created = 0;
    for (const slug of children.keys()) {
      let node = existing.get(slug);
      if (!node) {
        node = this.createNode(slug, parent);
        parent.children.push(node);
        created++;
      }
      nodes.push(node);
    }
    parent.children.sort(bySlug);

    const done = this.beginEdit("Subdivide", [parent, ...nodes]);
    parent.boundary = undefined;
    for (const node of nodes) node.boundary = children.get(node.slug);
    done();
    return { created, updated: nodes.length - created };
  }

  /** Whether the file of the node differs from what is in data/ */
  isModified(node: EditorNode): boolean {
    const file = nodeFile(node);
    if (!hasFile(node)) return file in this.saved;
    return node.dirty || node.raw !== this.saved[file];
  }

  /** Content of data/ as it is in the editor */
  files(): DataFiles {
    const files: DataFiles = {};
    for (const node of walk(this.root)) {
      if (!hasFile(node)) continue;
      files[nodeFile(node)] =
        !node.dirty && node.raw !== undefined ? node.raw : JSON.stringify(node.boundary);
    }
    return files;
  }

  changes(): DataChanges {
    const files = this.files();
    const write = new Map<string, string>();
    for (const [path, text] of Object.entries(files)) {
      if (this.saved[path] !== text) write.set(path, text);
    }
    return { write, delete: Object.keys(this.saved).filter((path) => !(path in files)) };
  }

  setGitStates(states: BoundaryStates) {
    this.gitStates = states;
    this.gitVersion++;
    this.version++;
  }

  boundaryState(node: EditorNode): BoundaryState {
    const cached = this.stateCache.get(node);
    if (hasFile(node)) {
      if (
        cached &&
        cached.dirty === node.dirty &&
        cached.raw === node.raw &&
        cached.gitVersion === this.gitVersion
      ) {
        return cached.state;
      }
      const path = nodeFile(node);
      const isMod = this.isModified(node);
      const state: BoundaryState = isMod
        ? this.saved[path] === undefined
          ? "new"
          : "modified"
        : (this.gitStates[path] ?? (this.saved[path] === undefined ? "new" : "committed"));
      this.stateCache.set(node, {
        revision: node.revision,
        gitVersion: this.gitVersion,
        dirty: node.dirty,
        raw: node.raw,
        state,
      });
      return state;
    }

    if (
      cached &&
      cached.revision === node.revision &&
      cached.gitVersion === this.gitVersion
    ) {
      return cached.state;
    }

    const states: BoundaryState[] = [];
    for (const child of node.children) {
      states.push(this.boundaryState(child));
    }
    let state: BoundaryState;
    if (!states.length || states.every((s) => s === states[0])) {
      state = states[0] ?? "committed";
    } else if (states.includes("modified")) {
      state = "modified";
    } else if (states.includes("new")) {
      state = "new";
    } else if (states.includes("staged")) {
      state = "staged";
    } else {
      state = "committed";
    }
    this.stateCache.set(node, {
      revision: node.revision,
      gitVersion: this.gitVersion,
      dirty: node.dirty,
      raw: node.raw,
      state,
    });
    return state;
  }

  /** Number of files of data/ that would be written or deleted */
  get modifiedCount() {
    if (this.cachedModifiedCount?.version === this.version) {
      return this.cachedModifiedCount.count;
    }
    let count = 0;
    const paths = new Set<string>();
    for (const node of walk(this.root)) {
      if (hasFile(node)) {
        paths.add(nodeFile(node));
        if (this.isModified(node)) count++;
      }
    }
    for (const path of Object.keys(this.saved)) if (!paths.has(path)) count++;
    this.cachedModifiedCount = { version: this.version, count };
    return count;
  }

  /** Call once `files` is what data/ contains */
  markSaved(files: DataFiles) {
    this.saved = files;
    this.gitVersion++;
    for (const node of walk(this.root)) {
      const raw = files[nodeFile(node)];
      if (raw === undefined || !hasFile(node)) continue;
      node.raw = raw;
      node.dirty = false;
    }
    this.version++;
  }

  filterTree(query: string): { visible: Set<number>; open: Set<number> } | undefined {
    const q = query.trim().toLowerCase();
    if (!q) return;
    const visible = new Set<number>();
    const open = new Set<number>();

    function walkNode(n: EditorNode): boolean {
      const self = n.slug.toLowerCase().includes(q) || nodeName(n).toLowerCase().includes(q);
      let childMatch = false;
      for (const child of n.children) {
        if (walkNode(child)) childMatch = true;
      }
      if (self || childMatch) visible.add(n.id);
      if (childMatch) open.add(n.id);
      return self || childMatch;
    }
    walkNode(this.root);
    return { visible, open };
  }
}
