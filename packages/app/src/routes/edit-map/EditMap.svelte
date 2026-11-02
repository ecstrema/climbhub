<script lang="ts">
  import "maplibre-gl/dist/maplibre-gl.css";
  import {
    Map as MapLibreMap,
    NavigationControl,
    Popup,
    ScaleControl,
    type GeoJSONSource,
    type MapLayerMouseEvent,
    type MapMouseEvent,
  } from "maplibre-gl";
  import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
  import { onMount } from "svelte";
  import { PersistentState } from "@friendofsvelte/state";

  import {
    findVertices,
    forEachRing,
    getRing,
    insertOnSegment,
    isEmptyBBox,
    labelPoint,
    mergeBoundaries,
    mergeBoundariesAtPoints,
    moveVertex,
    boundaryPolygons,
    polygonsContain,
    positionKey,
    preparePolygons,
    simplifyRing,
    type BBox,
    type VertexRef,
  } from "./geometry";
  import {
    hasFile,
    MAX_EDITABLE_VERTICES,
    nodeName,
    PointStatus,
    walk,
    type EditorNode,
    type EditorStore,
  } from "./editor.svelte";
  import { BOUNDARY_STATE_COLORS, type BoundaryState } from "./types";

  const { store }: { store: EditorStore } = $props();

  // Categorical palette for the children of the selected node
  const PALETTE = [
    "#2563eb",
    "#16a34a",
    "#d97706",
    "#9333ea",
    "#0891b2",
    "#db2777",
    "#65a30d",
    "#dc2626",
    "#4f46e5",
    "#0d9488",
  ];

  let container: HTMLDivElement;
  let map: MapLibreMap | undefined;
  let loaded = $state(false);
  const showAllBoundaries = new PersistentState("edit-map:show-all-boundaries", false);
  type BoundaryStatusFilter = "all" | BoundaryState;
  const boundaryStatusFilter = new PersistentState<BoundaryStatusFilter>(
    "edit-map:boundary-status",
    "all",
  );
  let showPoints = $state(true);

  type PointType = "crag" | "gym" | "ambiguous" | "unassigned";
  const POINT_TYPES: { type: PointType; color: string; label: string }[] = [
    { type: "crag", color: "#0f766e", label: "crag / area" },
    { type: "gym", color: "#7c3aed", label: "gym" },
    { type: "ambiguous", color: "#f59e0b", label: "in overlapping regions" },
    { type: "unassigned", color: "#dc2626", label: "in no region (dropped)" },
  ];
  const shownPointTypes = new PersistentState<Record<PointType, boolean>>("edit-map:point-types", {
    crag: true,
    gym: true,
    ambiguous: true,
    unassigned: true,
  });
  /** Factor of the radius of the climbing places */
  const pointSize = new PersistentState("edit-map:point-size", 1);

  function pointType(i: number): PointType {
    const status = store.status[i];
    if (status === PointStatus.Unassigned) return "unassigned";
    if (status === PointStatus.Ambiguous) return "ambiguous";
    return store.points[i]?.kind === "gym" ? "gym" : "crag";
  }

  const empty: FeatureCollection = { type: "FeatureCollection", features: [] };

  function source(id: string) {
    return map?.getSource(id) as GeoJSONSource | undefined;
  }

  /** Nodes drawn on the map, and how */
  function displayedNodes(): { node: EditorNode; role: "selected" | "child" | "context" }[] {
    const selected = store.selected ?? store.root;
    const result: { node: EditorNode; role: "selected" | "child" | "context" }[] = [];
    for (const sibling of selected.parent?.children ?? []) {
      if (sibling !== selected) result.push({ node: sibling, role: "context" });
    }
    result.push({ node: selected, role: "selected" });
    for (const child of selected.children) result.push({ node: child, role: "child" });
    return result;
  }

  // The whole world has more than a million vertices: sending them all to the map on every change
  // is slow. The boundaries are drawn simplified to about a pixel of the view of the selected node,
  // which is drawn as is, to be edited.

  /** In degrees, 0 to draw the boundaries as they are */
  function displayTolerance(): number {
    const b = (store.selected ?? store.root).bbox;
    if (isEmptyBBox(b)) return 0;
    const tolerance = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 4000;
    // A power of 2, so that the cache is used across the selections of similar sizes
    return tolerance < 0.001 ? 0 : 2 ** Math.floor(Math.log2(tolerance));
  }

  type BoundaryFeature = Feature<Polygon | MultiPolygon>;
  const displayCache = new WeakMap<
    EditorNode,
    { revision: number; tolerance: number; features: BoundaryFeature[] }
  >();

  /** The features of a leaf, simplified for the display */
  function displayFeatures(node: EditorNode, tolerance: number): BoundaryFeature[] {
    const features = node.boundary?.features ?? [];
    if (!tolerance || node === store.selected) return features;
    const cached = displayCache.get(node);
    if (cached?.revision === node.revision && cached.tolerance === tolerance)
      return cached.features;
    // Without topology: neighbouring borders may not match exactly anymore, by less than a pixel
    const rings = (rings: Position[][]) =>
      rings.map((ring) => simplifyRing(ring, tolerance * tolerance, () => false) ?? ring);
    const simplified = features.map((feature): BoundaryFeature => {
      const geometry = feature.geometry;
      return {
        ...feature,
        geometry:
          geometry.type === "Polygon"
            ? { type: "Polygon", coordinates: rings(geometry.coordinates) }
            : { type: "MultiPolygon", coordinates: geometry.coordinates.map(rings) },
      };
    });
    displayCache.set(node, { revision: node.revision, tolerance, features: simplified });
    return simplified;
  }

  /** Groups have no boundary: they are drawn with the boundaries of their leaves */
  function regionFeatures(node: EditorNode, tolerance: number) {
    if (node.boundary?.features.length) return displayFeatures(node, tolerance);
    return [...walk(node)].flatMap((n) => (n.children.length ? [] : displayFeatures(n, tolerance)));
  }

  const labelCache = new WeakMap<
    EditorNode,
    { revision: number; tolerance: number; point: Position | undefined }
  >();

  function regionLabel(node: EditorNode, tolerance: number) {
    const cached = labelCache.get(node);
    if (cached?.revision === node.revision && cached.tolerance === tolerance) return cached.point;
    const point = labelPoint(
      boundaryPolygons({ type: "FeatureCollection", features: regionFeatures(node, tolerance) }),
    );
    labelCache.set(node, { revision: node.revision, tolerance, point });
    return point;
  }

  function boundaryFeatures(tolerance: number): FeatureCollection {
    const features: Feature[] = [];
    displayedNodes().forEach(({ node, role }, i) => {
      // Only drawn around the selected node, in grey
      const nodeTolerance = role === "context" ? tolerance * 4 : tolerance;
      const areas = node.children.length
        ? [...walk(node)].filter(hasFile)
        : hasFile(node)
          ? [node]
          : [];
      for (const area of areas) {
        const isMergeSelected = store.mergeSelection.has(area);
        for (const feature of displayFeatures(area, nodeTolerance)) {
          features.push({
            type: "Feature",
            geometry: feature.geometry,
            properties: {
              nodeId: area.id,
              role: isMergeSelected ? "mergeSelected" : role,
              color: isMergeSelected
                ? "#f43f5e"
                : role === "child"
                  ? PALETTE[i % PALETTE.length]
                  : "#475569",
              state: store.boundaryState(area),
            },
          });
        }
      }
    });
    return { type: "FeatureCollection", features };
  }

  function labelFeatures(tolerance: number): FeatureCollection {
    const features: Feature[] = [];
    for (const { node, role } of displayedNodes()) {
      if (role === "context" && store.selected) continue;
      const point = regionLabel(node, tolerance);
      if (!point) continue;
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: point },
        properties: {
          label: `${nodeName(node)}\n${node.total}`,
          role,
          state: store.boundaryState(node),
        },
      });
    }
    return { type: "FeatureCollection", features };
  }

  function allBoundaryFeatures(tolerance: number): FeatureCollection {
    const features: Feature[] = [];
    for (const node of store.nodesById.values()) {
      if (node.children.length) continue;
      for (const feature of displayFeatures(node, tolerance)) {
        features.push({
          type: "Feature",
          geometry: feature.geometry,
          properties: { state: store.boundaryState(node) },
        });
      }
    }
    return { type: "FeatureCollection", features };
  }

  /** The nodes whose vertices are displayed */
  function vertexNodes(): { node: EditorNode; canEdit: boolean }[] {
    const list: { node: EditorNode; canEdit: boolean }[] = [];
    if (store.editing && store.selected?.boundary && store.selected.vertexCount <= MAX_EDITABLE_VERTICES) {
      list.push({ node: store.selected, canEdit: true });
    }
    if (store.mergeMode || store.mergeSelection.size > 0) {
      for (const n of store.mergeSelection) {
        if (!list.some((item) => item.node === n) && n.boundary && n.vertexCount <= MAX_EDITABLE_VERTICES * 2) {
          list.push({ node: n, canEdit: false });
        }
      }
    }
    return list;
  }

  function editableNode(): EditorNode | undefined {
    const node = store.selected;
    if (store.editing && node?.boundary && node.vertexCount <= MAX_EDITABLE_VERTICES) return node;
  }

  function segmentMidpoint(a: Position, b: Position): Position {
    return [(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2];
  }

  function vertexFeatures(includeMidpoints = true): { vertices: FeatureCollection; midpoints: FeatureCollection } {
    const nodes = vertexNodes();
    if (!nodes.length) return { vertices: empty, midpoints: empty };
    const vertices: Feature[] = [];
    const midpoints: Feature[] = [];
    const selection = store.vertexSelection;
    const hasSelection = selection.size > 0;
    for (const { node, canEdit } of nodes) {
      forEachRing(node.boundary!, (ring, ref) => {
        for (let v = 0; v < ring.length - 1; v++) {
          const properties = { nodeId: node.id, ...ref, vertex: v };
          const a = ring[v]!;
          vertices.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: a },
            properties: { ...properties, selected: hasSelection && selection.has(positionKey(a)) },
          });
          if (includeMidpoints && canEdit) {
            const b = ring[v + 1]!;
            midpoints.push({
              type: "Feature",
              geometry: { type: "Point", coordinates: [(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2] },
              properties,
            });
          }
        }
      });
    }
    return {
      vertices: { type: "FeatureCollection", features: vertices },
      midpoints: { type: "FeatureCollection", features: midpoints },
    };
  }

  /** What the boundaries and labels were last drawn from */
  let renderedKey = "";

  /** `dragging`: the boundaries change continuously, the labels are updated at the end */
  function renderBoundaries(dragging = false) {
    if (!map || !loaded) return;
    const selected = store.selected ?? store.root;
    const tolerance = displayTolerance();
    // The siblings and children of the selected node are drawn: the revision of the parent changes
    // with any of them. The labels show the number of places.
    const mergeKey = [...store.mergeSelection].map((n) => n.id).sort().join(",");
    const vSelKey = [...store.vertexSelection.keys()].sort().join(",");
    const key = `${selected.id} ${(selected.parent ?? selected).revision} ${tolerance} ${store.pointsVersion} ${store.version} ${mergeKey} ${store.mergeMode} ${store.mergeSideIndex} ${vSelKey} ${store.editing}`;
    if (dragging || key !== renderedKey) {
      source("boundaries")?.setData(boundaryFeatures(tolerance));
      if (!dragging) {
        source("labels")?.setData(labelFeatures(tolerance));
        renderedKey = key;
      }
    }
    const { vertices, midpoints } = vertexFeatures(!dragging);
    source("vertices")?.setData(vertices);
    if (!dragging) source("midpoints")?.setData(midpoints);
  }

  // Live preview of merged boundary when multiple regions are selected
  $effect(() => {
    void store.version;
    const mergeNodes = [...store.mergeSelection];
    const points = [...store.vertexSelection.values()];
    if (mergeNodes.length === 2 && points.length === 2 && mergeNodes[0]?.boundary && mergeNodes[1]?.boundary) {
      const res = mergeBoundariesAtPoints(
        mergeNodes[0].boundary,
        mergeNodes[1].boundary,
        points[0]!,
        points[1]!,
        store.mergeSideIndex,
      );
      if (res) {
        store.preview = res.boundary;
        return;
      }
    }
    if (mergeNodes.length >= 2) {
      store.preview = mergeBoundaries(mergeNodes.map((n) => n.boundary));
    } else if (store.mergeMode && mergeNodes.length < 2 && store.preview) {
      store.preview = undefined;
    }
  });

  let frame: number | undefined;
  function scheduleRender() {
    frame ??= requestAnimationFrame(() => {
      frame = undefined;
      renderBoundaries(true);
    });
  }

  // The status changes with the boundaries: it is a feature state, that filters cannot use. The
  // hidden types are drawn transparent instead.
  const pointStatus = ["coalesce", ["feature-state", "status"], ["get", "status"]];
  const pointTypeExpression = [
    "case",
    ["==", pointStatus, PointStatus.Unassigned],
    "unassigned",
    ["==", pointStatus, PointStatus.Ambiguous],
    "ambiguous",
    ["==", ["get", "kind"], "gym"],
    "gym",
    "crag",
  ];
  const pointOpacity = (shown: Record<PointType, boolean>): any => [
    "match",
    pointTypeExpression,
    ...POINT_TYPES.flatMap((t) => [t.type, shown[t.type] ? 1 : 0]),
    1,
  ];
  const pointRadius = (size: number): any => [
    "interpolate",
    ["linear"],
    ["zoom"],
    2,
    1.5 * size,
    8,
    3 * size,
    14,
    5 * size,
  ];

  function pointFeatures(): FeatureCollection {
    return {
      type: "FeatureCollection",
      features: store.points.map((p, i) => ({
        type: "Feature",
        id: i,
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
        properties: { i, kind: p.kind, status: store.status[i] },
      })),
    };
  }

  export function getViewBBox(): BBox {
    const bounds = map!.getBounds();
    // A bit smaller than the view, so that the vertices are visible
    const dx = (bounds.getEast() - bounds.getWest()) * 0.1;
    const dy = (bounds.getNorth() - bounds.getSouth()) * 0.1;
    return {
      x0: bounds.getWest() + dx,
      x1: bounds.getEast() - dx,
      y0: bounds.getSouth() + dy,
      y1: bounds.getNorth() - dy,
    };
  }

  export function fitTo(b: BBox) {
    if (!map || isEmptyBBox(b)) return;
    map.fitBounds(
      [
        [Math.max(b.x0, -180), Math.max(b.y0, -85)],
        [Math.min(b.x1, 180), Math.min(b.y1, 85)],
      ],
      { padding: 40, duration: 600 },
    );
  }

  // ---------------------------------------------------------------------------------------------
  // Vertex editing
  // ---------------------------------------------------------------------------------------------

  /** All the vertices at `position`, in the selected node and (if linked) in its neighbours */
  function linkedTargets(node: EditorNode, position: Position) {
    const nodes = [node];
    if (store.linkVertices) {
      const area = { x0: position[0]!, x1: position[0]!, y0: position[1]!, y1: position[1]! };
      nodes.push(...store.neighbours(node, area));
    }
    return nodes
      .map((n) => ({ node: n, refs: findVertices(n.boundary!, position) }))
      .filter((t) => t.refs.length > 0);
  }

  function refFromFeature(e: MapLayerMouseEvent): VertexRef | undefined {
    const p = e.features?.[0]?.properties;
    if (!p) return;
    return { feature: p.feature, polygon: p.polygon, ring: p.ring, vertex: p.vertex };
  }

  function startDrag(
    targets: { node: EditorNode; refs: VertexRef[] }[],
    label: string,
    onEnd?: (position: Position) => void,
  ) {
    if (!map) return;
    const done = store.beginEdit(
      label,
      targets.map((t) => t.node),
    );
    map.getCanvas().style.cursor = "grabbing";

    let position: Position | undefined;
    const onMove = (e: { lngLat: { lng: number; lat: number } }) => {
      position = [e.lngLat.lng, e.lngLat.lat];
      for (const { node, refs } of targets) {
        for (const ref of refs) moveVertex(node.boundary!, ref, position);
      }
      scheduleRender();
    };
    map.on("mousemove", onMove);
    window.addEventListener(
      "mouseup",
      () => {
        map?.off("mousemove", onMove);
        if (map) map.getCanvas().style.cursor = "";
        done();
        if (position) onEnd?.(position);
      },
      { once: true },
    );
  }

  function getPosition(node: EditorNode, ref: VertexRef): Position | undefined {
    return getRing(node.boundary!, ref)?.[ref.vertex];
  }

  function onVertexDown(e: MapLayerMouseEvent) {
    const feat = e.features?.[0];
    const nodeId = feat?.properties?.nodeId;
    const node = (nodeId ? store.nodesById.get(nodeId) : undefined) ?? store.selected;
    const ref = refFromFeature(e);
    if (!node?.boundary || !ref || e.originalEvent.button !== 0) return;
    e.preventDefault();
    const position = getPosition(node, ref);
    if (!position) return;
    const key = positionKey(position);
    if (e.originalEvent.shiftKey || store.mergeMode || store.mergeSelection.size > 0) {
      toggleSelection(position);
      return;
    }
    if (!store.editing) return;
    startDrag(linkedTargets(node, position), "Move vertex", (end) => {
      // A selected vertex stays selected where it is dropped
      if (!store.vertexSelection.has(key)) return;
      const selection = new Map(store.vertexSelection);
      selection.delete(key);
      selection.set(positionKey(end), end);
      store.vertexSelection = selection;
    });
  }

  function toggleSelection(position: Position) {
    const selection = new Map(store.vertexSelection);
    const key = positionKey(position);
    if (selection.has(key)) selection.delete(key);
    else selection.set(key, position);
    store.vertexSelection = selection;
  }

  /** Shift + drag outside of a vertex: draws a lasso, and selects the vertices inside or regions for merge */
  function onMapMouseDown(e: MapMouseEvent) {
    if (!e.originalEvent.shiftKey || e.originalEvent.button !== 0 || !map) return;
    const node = editableNode();
    const isMergeLasso = !node && (store.mergeMode || store.mergeSelection.size > 0);
    if (!node && !isMergeLasso) return;
    if (map.queryRenderedFeatures(e.point, { layers: ["vertices", "midpoints"] }).length) return;
    e.preventDefault();
    const lasso: Position[] = [[e.lngLat.lng, e.lngLat.lat]];
    const onMove = (ev: MapMouseEvent) => {
      lasso.push([ev.lngLat.lng, ev.lngLat.lat]);
      source("lasso")?.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: [...lasso, lasso[0]!] },
      });
    };
    map.on("mousemove", onMove);
    window.addEventListener(
      "mouseup",
      () => {
        map?.off("mousemove", onMove);
        source("lasso")?.setData(empty);
        if (lasso.length < 3) return;
        const prepared = preparePolygons([[[...lasso, lasso[0]!]]]);

        if (node?.boundary) {
          const selection = new Map(store.vertexSelection);
          forEachRing(node.boundary, (ring) => {
            for (const p of ring.slice(0, -1)) {
              if (polygonsContain(prepared, p[0]!, p[1]!)) selection.set(positionKey(p), p);
            }
          });
          store.vertexSelection = selection;
        } else if (isMergeLasso) {
          const current = store.selected ?? store.root;
          const candidateLeaves = current.children.length
            ? current.children.filter((c) => !c.children.length && c.boundary)
            : (current.parent?.children ?? []).filter((c) => !c.children.length && c.boundary);

          const selection = new Set(store.mergeSelection);
          for (const candidate of candidateLeaves) {
            let hit = false;
            forEachRing(candidate.boundary!, (ring) => {
              if (hit) return;
              for (const p of ring) {
                if (polygonsContain(prepared, p[0]!, p[1]!)) {
                  hit = true;
                  break;
                }
              }
            });
            if (hit) selection.add(candidate);
          }
          store.mergeSelection = selection;
        }
      },
      { once: true },
    );
  }

  function onMidpointDown(e: MapLayerMouseEvent) {
    const node = store.selected;
    const ref = refFromFeature(e);
    if (!node?.boundary || !ref || e.originalEvent.button !== 0) return;
    e.preventDefault();
    const a = getPosition(node, ref);
    const b = getPosition(node, { ...ref, vertex: ref.vertex + 1 });
    if (!a || !b) return;
    const middle = segmentMidpoint(a, b);

    // Insert the vertex in every boundary having the same segment, to keep the border shared
    const nodes = [node, ...(store.linkVertices ? linkedTargets(node, a).map((t) => t.node) : [])];
    for (const n of new Set(nodes)) insertOnSegment(n.boundary!, a, b, middle);
    startDrag(linkedTargets(node, middle), "Add vertex");
  }

  function onVertexContextMenu(e: MapLayerMouseEvent) {
    const node = store.selected;
    const ref = refFromFeature(e);
    if (!node?.boundary || !ref) return;
    e.preventDefault();
    const position = getPosition(node, ref);
    if (position) store.removeVertices(node, [position]);
  }

  // ---------------------------------------------------------------------------------------------

  onMount(() => {
    map = new MapLibreMap({
      container,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [0, 30],
      zoom: 1.5,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new ScaleControl({}), "bottom-right");

    map.on("load", () => {
      const m = map!;
      m.addSource("all-boundaries", { type: "geojson", data: empty });
      m.addSource("boundaries", { type: "geojson", data: empty });
      m.addSource("preview", { type: "geojson", data: empty });
      m.addSource("points", { type: "geojson", data: empty });
      m.addSource("labels", { type: "geojson", data: empty });
      m.addSource("midpoints", { type: "geojson", data: empty });
      m.addSource("vertices", { type: "geojson", data: empty });
      m.addSource("lasso", { type: "geojson", data: empty });

      m.addLayer({
        id: "all-boundaries",
        type: "line",
        source: "all-boundaries",
        paint: {
          "line-color": [
            "match",
            ["get", "state"],
            ...Object.entries(BOUNDARY_STATE_COLORS).flat(),
            "#64748b",
          ],
          "line-width": 0.6,
          "line-opacity": 0.6,
        },
      });
      m.addLayer({
        id: "boundary-fill",
        type: "fill",
        source: "boundaries",
        filter: ["!=", ["get", "role"], "context"],
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": [
            "match",
            ["get", "role"],
            "mergeSelected",
            0.4,
            "child",
            0.18,
            0.05,
          ],
        },
      });
      m.addLayer({
        id: "boundary-context-fill",
        type: "fill",
        source: "boundaries",
        filter: ["==", ["get", "role"], "context"],
        paint: { "fill-color": "#94a3b8", "fill-opacity": 0.04 },
      });
      m.addLayer({
        id: "boundary-line",
        type: "line",
        source: "boundaries",
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "role"], "mergeSelected"],
            "#f43f5e",
            [
              "match",
              ["get", "state"],
              ...Object.entries(BOUNDARY_STATE_COLORS).flat(),
              "#64748b",
            ],
          ],
          "line-width": [
            "match",
            ["get", "role"],
            "mergeSelected",
            3,
            "selected",
            2.5,
            "child",
            1.5,
            1,
          ],
        },
      });
      m.addLayer({
        id: "boundary-editing-line",
        type: "line",
        source: "boundaries",
        filter: ["==", ["get", "role"], "selected"],
        paint: { "line-color": "#64748b", "line-width": 3 },
      });
      m.addLayer({
        id: "preview-fill",
        type: "fill",
        source: "preview",
        paint: { "fill-color": "#e11d48", "fill-opacity": 0.08 },
      });
      m.addLayer({
        id: "preview-line",
        type: "line",
        source: "preview",
        paint: { "line-color": "#e11d48", "line-width": 2, "line-dasharray": [2, 1] },
      });
      m.addLayer({
        id: "points",
        type: "circle",
        source: "points",
        paint: {
          "circle-radius": pointRadius(pointSize.current),
          "circle-color": [
            "match",
            pointTypeExpression,
            ...POINT_TYPES.flatMap((t) => [t.type, t.color]),
            "#0f766e",
          ],
          "circle-opacity": pointOpacity(shownPointTypes.current),
          "circle-stroke-opacity": pointOpacity(shownPointTypes.current),
          "circle-stroke-width": ["case", ["==", pointStatus, PointStatus.Assigned], 0, 1],
          "circle-stroke-color": "#ffffff",
        },
      });
      m.addLayer({
        id: "labels",
        type: "symbol",
        source: "labels",
        layout: {
          "text-field": ["get", "label"],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["case", ["==", ["get", "role"], "selected"], 14, 12],
        },
        paint: { "text-color": "#0f172a", "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
      });
      m.addLayer({
        id: "midpoints",
        type: "circle",
        source: "midpoints",
        paint: {
          "circle-radius": 3,
          "circle-color": "#ffffff",
          "circle-stroke-color": "#2563eb",
          "circle-stroke-width": 1,
          "circle-opacity": 0.7,
        },
      });
      m.addLayer({
        id: "vertices",
        type: "circle",
        source: "vertices",
        paint: {
          "circle-radius": ["case", ["get", "selected"], 6, 4.5],
          "circle-color": ["case", ["get", "selected"], "#f97316", "#2563eb"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });
      m.addLayer({
        id: "lasso",
        type: "line",
        source: "lasso",
        paint: { "line-color": "#f97316", "line-width": 1.5, "line-dasharray": [2, 1] },
      });

      m.on("mousedown", "vertices", onVertexDown);
      m.on("mousedown", "midpoints", onMidpointDown);
      m.on("contextmenu", "vertices", onVertexContextMenu);
      m.on("mousedown", onMapMouseDown);
      for (const layer of ["vertices", "midpoints"]) {
        m.on("mouseenter", layer, () => (m.getCanvas().style.cursor = "move"));
        m.on("mouseleave", layer, () => (m.getCanvas().style.cursor = ""));
      }

      m.on("click", (e) => {
        const hit = m
          .queryRenderedFeatures(e.point, { layers: ["vertices", "midpoints", "points"] })
          .find(
            (f) => f.layer.id !== "points" || shownPointTypes.current[pointType(f.properties.i)],
          );
        if (hit?.layer.id === "points") {
          const p = store.points[hit.properties.i];
          if (!p) return;
          const type = { n: "node", w: "way", r: "relation" }[p.id[0] as "n" | "w" | "r"];
          const node = store.nodesById.get(store.assignment[hit.properties.i]!);
          new Popup({ closeButton: false, className: "edit-map-popup" })
            .setLngLat([p.lon, p.lat])
            .setHTML(
              `<b>${escapeHtml(p.name ?? "(no name)")}</b> · ${p.kind}<br>` +
                `<a href="https://www.openstreetmap.org/${type}/${p.id.slice(1)}" target="_blank">${p.id}</a><br>` +
                (node
                  ? `in ${escapeHtml(nodeName(node))}`
                  : `<span style="color:#dc2626">not in any region</span>`),
            )
            .addTo(m);
          return;
        }
        if (hit) return;
        if (store.vertexSelection.size && !e.originalEvent.shiftKey) {
          store.vertexSelection = new Map();
          return;
        }
        // Select or toggle child/region under the cursor
        const [child] = m.queryRenderedFeatures(e.point, {
          layers: ["boundary-fill", "boundary-context-fill"],
        });
        const node = child && store.nodesById.get(child.properties.nodeId);
        if (node && !node.children.length) {
          if (
            store.mergeMode ||
            e.originalEvent.ctrlKey ||
            e.originalEvent.metaKey ||
            e.originalEvent.shiftKey
          ) {
            store.toggleMerge(node);
            return;
          }
          if (child.properties.role === "child") {
            store.selected = node;
            return;
          }
        } else if (node && child.properties.role === "child") {
          store.selected = node;
        }
      });

      loaded = true;
    });

    return () => map?.remove();
  });

  function escapeHtml(text: string) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Status changes of the climbing places
  $effect(() => {
    store.onPointsChanged = (indexes) => {
      if (!map || !loaded) return;
      for (const i of indexes) {
        map.setFeatureState({ source: "points", id: i }, { status: store.status[i] });
      }
    };
    return () => (store.onPointsChanged = undefined);
  });

  $effect(() => {
    // Redraw on any change of the tree, selection, or editing mode
    void store.version;
    void store.selected;
    void store.editing;
    void store.vertexSelection;
    if (loaded) renderBoundaries();
  });

  // The vertex selection is for the edited node only
  $effect(() => {
    void store.selected;
    void store.editing;
    store.vertexSelection = new Map();
  });

  // Shift + drag draws a lasso instead of zooming while editing or merging
  $effect(() => {
    const lassoActive = store.editing || store.mergeMode || store.mergeSelection.size > 0;
    if (!loaded || !map) return;
    if (lassoActive) map.boxZoom.disable();
    else map.boxZoom.enable();
  });

  $effect(() => {
    void store.pointsVersion;
    if (!loaded) return;
    map?.removeFeatureState({ source: "points" });
    source("points")?.setData(pointFeatures());
  });

  $effect(() => {
    const preview = store.preview;
    if (loaded) source("preview")?.setData(preview ?? empty);
  });

  let allBoundariesKey = "";
  $effect(() => {
    void store.version;
    const show = showAllBoundaries.current;
    if (!loaded) return;
    const tolerance = 0.01;
    const key = show ? `${store.root.revision} ${tolerance} ${store.version}` : "";
    if (key === allBoundariesKey) return;
    allBoundariesKey = key;
    source("all-boundaries")?.setData(show ? allBoundaryFeatures(tolerance) : empty);
  });

  $effect(() => {
    const status = boundaryStatusFilter.current;
    if (!loaded) return;
    if (status === "all") {
      map?.setFilter("all-boundaries", null);
      map?.setFilter("boundary-line", null);
      map?.setFilter("boundary-fill", ["!=", ["get", "role"], "context"]);
      map?.setFilter("boundary-context-fill", ["==", ["get", "role"], "context"]);
      map?.setFilter("labels", null);
    } else {
      const stateFilter = ["==", ["get", "state"], status] as any;
      const selectedWhileEditing = store.editing
        ? ["==", ["get", "role"], "selected"]
        : ["==", ["get", "role"], "__not-selected"];
      const visibleFilter = ["any", stateFilter, selectedWhileEditing] as any;
      map?.setFilter("all-boundaries", stateFilter);
      map?.setFilter("boundary-line", visibleFilter);
      map?.setFilter("boundary-fill", ["all", ["!=", ["get", "role"], "context"], visibleFilter]);
      map?.setFilter("boundary-context-fill", [
        "all",
        ["==", ["get", "role"], "context"],
        visibleFilter,
      ]);
      map?.setFilter("labels", visibleFilter);
    }
  });

  $effect(() => {
    const visibility = store.editing ? "visible" : "none";
    if (loaded) map?.setLayoutProperty("boundary-editing-line", "visibility", visibility);
  });

  $effect(() => {
    const visibility = showPoints ? "visible" : "none";
    if (loaded) map?.setLayoutProperty("points", "visibility", visibility);
  });

  $effect(() => {
    const opacity = pointOpacity(shownPointTypes.current);
    if (!loaded) return;
    map?.setPaintProperty("points", "circle-opacity", opacity);
    map?.setPaintProperty("points", "circle-stroke-opacity", opacity);
  });

  $effect(() => {
    const radius = pointRadius(pointSize.current);
    if (loaded) map?.setPaintProperty("points", "circle-radius", radius);
  });
</script>

<div class="relative h-full w-full">
  <div bind:this={container} class="h-full w-full"></div>
  <div
    class="absolute top-2 left-2 flex flex-col gap-1 rounded-md bg-background/90 p-2 text-xs shadow"
  >
    <label class="flex items-center gap-1.5">
      <input type="checkbox" bind:checked={showPoints} /> Climbing places
    </label>
    <label class="flex items-center gap-1.5">
      <input type="checkbox" bind:checked={showAllBoundaries.current} /> All leaf boundaries
    </label>
    <label class="flex items-center justify-between gap-2">
      Areas
      <select
        class="rounded border bg-background px-1 py-0.5"
        bind:value={boundaryStatusFilter.current}
      >
        <option value="all">All</option>
        <option value="new">New</option>
        <option value="modified">Modified</option>
        <option value="staged">Staged</option>
        <option value="committed">Committed</option>
      </select>
    </label>
    <div class="mt-1 flex flex-col gap-0.5 text-muted-foreground">
      {#each Object.entries(BOUNDARY_STATE_COLORS) as [state, color] (state)}
        <div class="flex items-center gap-1.5 capitalize">
          <span class="size-2 rounded-full" style:background-color={color}></span>{state}
        </div>
      {/each}
      {#each POINT_TYPES as { type, color, label } (type)}
        <label class="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={shownPointTypes.current[type]}
            onchange={(e) =>
              (shownPointTypes.current = {
                ...shownPointTypes.current,
                [type]: e.currentTarget.checked,
              })}
          />
          <span class="inline-block size-2 rounded-full" style:background-color={color}></span>
          {label}
        </label>
      {/each}
      <label class="mt-1 flex items-center gap-1.5">
        Size
        <input
          type="range"
          min="1"
          max="4"
          step="0.5"
          class="w-20"
          bind:value={pointSize.current}
        />
        <span class="tabular-nums">×{pointSize.current}</span>
      </label>
    </div>
  </div>
</div>

<style>
  /* MapLibre popups are white, whatever the theme: use the colors of the app */
  :global(.edit-map-popup .maplibregl-popup-content) {
    background: var(--popover);
    color: var(--popover-foreground);
  }
  :global(.edit-map-popup a) {
    color: var(--primary);
    text-decoration: underline;
  }
  :global(.edit-map-popup.maplibregl-popup-anchor-top .maplibregl-popup-tip),
  :global(.edit-map-popup.maplibregl-popup-anchor-top-left .maplibregl-popup-tip),
  :global(.edit-map-popup.maplibregl-popup-anchor-top-right .maplibregl-popup-tip) {
    border-bottom-color: var(--popover);
  }
  :global(.edit-map-popup.maplibregl-popup-anchor-bottom .maplibregl-popup-tip),
  :global(.edit-map-popup.maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip),
  :global(.edit-map-popup.maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip) {
    border-top-color: var(--popover);
  }
  :global(.edit-map-popup.maplibregl-popup-anchor-left .maplibregl-popup-tip) {
    border-right-color: var(--popover);
  }
  :global(.edit-map-popup.maplibregl-popup-anchor-right .maplibregl-popup-tip) {
    border-left-color: var(--popover);
  }
</style>
