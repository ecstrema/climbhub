<script lang="ts">
  import "maplibre-gl/dist/maplibre-gl.css";
  import {
    Map as MapLibreMap,
    NavigationControl,
    Popup,
    ScaleControl,
    type GeoJSONSource,
    type MapLayerMouseEvent,
  } from "maplibre-gl";
  import type { Feature, FeatureCollection, Position } from "geojson";
  import { onMount } from "svelte";

  import {
    findVertices,
    forEachRing,
    getRing,
    insertOnSegment,
    isEmptyBBox,
    labelPoint,
    moveVertex,
    removeVertex,
    boundaryPolygons,
    type BBox,
    type VertexRef,
  } from "./geometry";
  import {
    MAX_EDITABLE_VERTICES,
    nodeName,
    PointStatus,
    type EditorNode,
    type EditorStore,
  } from "./editor.svelte";

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
  let showAllBoundaries = $state(false);
  let showPoints = $state(true);

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

  function boundaryFeatures(): FeatureCollection {
    const features: Feature[] = [];
    displayedNodes().forEach(({ node, role }, i) => {
      for (const feature of node.boundary?.features ?? []) {
        features.push({
          type: "Feature",
          geometry: feature.geometry,
          properties: {
            nodeId: node.id,
            role,
            color: role === "child" ? PALETTE[i % PALETTE.length] : "#475569",
          },
        });
      }
    });
    return { type: "FeatureCollection", features };
  }

  function labelFeatures(): FeatureCollection {
    const features: Feature[] = [];
    for (const { node, role } of displayedNodes()) {
      if (role === "context" && store.selected) continue;
      const point = labelPoint(boundaryPolygons(node.boundary));
      if (!point) continue;
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: point },
        properties: { label: `${nodeName(node)}\n${node.total}`, role },
      });
    }
    return { type: "FeatureCollection", features };
  }

  function allBoundaryFeatures(): FeatureCollection {
    const features: Feature[] = [];
    for (const node of store.nodesById.values()) {
      if (node.children.length) continue;
      for (const feature of node.boundary?.features ?? []) {
        features.push({ type: "Feature", geometry: feature.geometry, properties: {} });
      }
    }
    return { type: "FeatureCollection", features };
  }

  function vertexFeatures(): { vertices: FeatureCollection; midpoints: FeatureCollection } {
    const node = store.selected;
    if (!store.editing || !node?.boundary || node.vertexCount > MAX_EDITABLE_VERTICES) {
      return { vertices: empty, midpoints: empty };
    }
    const vertices: Feature[] = [];
    const midpoints: Feature[] = [];
    forEachRing(node.boundary, (ring, ref) => {
      for (let v = 0; v < ring.length - 1; v++) {
        const properties = { ...ref, vertex: v };
        const a = ring[v]!;
        const b = ring[v + 1]!;
        vertices.push({ type: "Feature", geometry: { type: "Point", coordinates: a }, properties });
        midpoints.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2] },
          properties,
        });
      }
    });
    return {
      vertices: { type: "FeatureCollection", features: vertices },
      midpoints: { type: "FeatureCollection", features: midpoints },
    };
  }

  function renderBoundaries() {
    if (!map || !loaded) return;
    source("boundaries")?.setData(boundaryFeatures());
    source("labels")?.setData(labelFeatures());
    const { vertices, midpoints } = vertexFeatures();
    source("vertices")?.setData(vertices);
    source("midpoints")?.setData(midpoints);
  }

  let frame: number | undefined;
  function scheduleRender() {
    frame ??= requestAnimationFrame(() => {
      frame = undefined;
      renderBoundaries();
    });
  }

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

  function startDrag(targets: { node: EditorNode; refs: VertexRef[] }[], label: string) {
    if (!map) return;
    const done = store.beginEdit(
      label,
      targets.map((t) => t.node),
    );
    map.getCanvas().style.cursor = "grabbing";

    const onMove = (e: { lngLat: { lng: number; lat: number } }) => {
      const position = [e.lngLat.lng, e.lngLat.lat];
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
      },
      { once: true },
    );
  }

  function getPosition(node: EditorNode, ref: VertexRef): Position | undefined {
    return getRing(node.boundary!, ref)?.[ref.vertex];
  }

  function onVertexDown(e: MapLayerMouseEvent) {
    const node = store.selected;
    const ref = refFromFeature(e);
    if (!node?.boundary || !ref || e.originalEvent.button !== 0) return;
    e.preventDefault();
    const position = getPosition(node, ref);
    if (!position) return;
    startDrag(linkedTargets(node, position), "Move vertex");
  }

  function onMidpointDown(e: MapLayerMouseEvent) {
    const node = store.selected;
    const ref = refFromFeature(e);
    if (!node?.boundary || !ref || e.originalEvent.button !== 0) return;
    e.preventDefault();
    const a = getPosition(node, ref);
    const b = getPosition(node, { ...ref, vertex: ref.vertex + 1 });
    if (!a || !b) return;
    const middle = [(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2];

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
    if (!position) return;
    const targets = linkedTargets(node, position);
    const done = store.beginEdit(
      "Remove vertex",
      targets.map((t) => t.node),
    );
    for (const { node: n, refs } of targets) {
      for (const r of [...refs].sort((x, y) => y.vertex - x.vertex)) removeVertex(n.boundary!, r);
    }
    done();
  }

  // ---------------------------------------------------------------------------------------------

  onMount(() => {
    map = new MapLibreMap({
      container,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [0, 30],
      zoom: 1.5,
      attributionControl: { compact: true },
    });
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

      m.addLayer({
        id: "all-boundaries",
        type: "line",
        source: "all-boundaries",
        paint: { "line-color": "#64748b", "line-width": 0.6, "line-opacity": 0.6 },
      });
      m.addLayer({
        id: "boundary-fill",
        type: "fill",
        source: "boundaries",
        filter: ["!=", ["get", "role"], "context"],
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": ["case", ["==", ["get", "role"], "child"], 0.18, 0.05],
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
          "line-color": ["get", "color"],
          "line-width": ["match", ["get", "role"], "selected", 2.5, "child", 1.5, 1],
          "line-dasharray": ["match", ["get", "role"], "context", ["literal", [2, 2]], ["literal", [1]]],
        },
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
      const status = ["coalesce", ["feature-state", "status"], ["get", "status"]];
      m.addLayer({
        id: "points",
        type: "circle",
        source: "points",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 1.5, 8, 3, 14, 5],
          "circle-color": [
            "case",
            ["==", status, PointStatus.Unassigned],
            "#dc2626",
            ["==", status, PointStatus.Ambiguous],
            "#f59e0b",
            ["==", ["get", "kind"], "gym"],
            "#7c3aed",
            "#0f766e",
          ],
          "circle-stroke-width": ["case", ["==", status, PointStatus.Assigned], 0, 1],
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
          "circle-radius": 4.5,
          "circle-color": "#2563eb",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });

      m.on("mousedown", "vertices", onVertexDown);
      m.on("mousedown", "midpoints", onMidpointDown);
      m.on("contextmenu", "vertices", onVertexContextMenu);
      for (const layer of ["vertices", "midpoints"]) {
        m.on("mouseenter", layer, () => (m.getCanvas().style.cursor = "move"));
        m.on("mouseleave", layer, () => (m.getCanvas().style.cursor = ""));
      }

      m.on("click", (e) => {
        const [hit] = m.queryRenderedFeatures(e.point, {
          layers: ["vertices", "midpoints", "points"],
        });
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
                (node ? `in ${escapeHtml(nodeName(node))}` : `<span style="color:#dc2626">not in any region</span>`),
            )
            .addTo(m);
          return;
        }
        if (hit) return;
        // Select the child under the cursor
        const [child] = m.queryRenderedFeatures(e.point, { layers: ["boundary-fill"] });
        const node = child && store.nodesById.get(child.properties.nodeId);
        if (node && child.properties.role === "child") store.selected = node;
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
    if (loaded) renderBoundaries();
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

  $effect(() => {
    void store.version;
    const show = showAllBoundaries;
    if (loaded) source("all-boundaries")?.setData(show ? allBoundaryFeatures() : empty);
  });

  $effect(() => {
    const visibility = showPoints ? "visible" : "none";
    if (loaded) map?.setLayoutProperty("points", "visibility", visibility);
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
      <input type="checkbox" bind:checked={showAllBoundaries} /> All leaf boundaries
    </label>
    <div class="mt-1 flex flex-col gap-0.5 text-muted-foreground">
      <span><span class="inline-block size-2 rounded-full bg-[#0f766e]"></span> crag / area</span>
      <span><span class="inline-block size-2 rounded-full bg-[#7c3aed]"></span> gym</span>
      <span><span class="inline-block size-2 rounded-full bg-[#f59e0b]"></span> in overlapping regions</span>
      <span><span class="inline-block size-2 rounded-full bg-[#dc2626]"></span> in no region (dropped)</span>
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
