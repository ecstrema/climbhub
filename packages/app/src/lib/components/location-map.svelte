<script module lang="ts">
  import "maplibre-gl/dist/maplibre-gl.css";
  import { Map as MapLibreMap, NavigationControl, Popup, type GeoJSONSource } from "maplibre-gl";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { dataClient } from "#lib/data/network/data-client.js";

  // One map (and WebGL context) for the whole app: it is moved into whichever page shows a map.
  let shared: { map: MapLibreMap; element: HTMLDivElement } | undefined;
  /** Kept across pages, as the user can resize the map */
  let height: number | undefined;
  /** False until the view was first set to a place */
  let positioned = false;
  let overviewLoaded = false;

  /** Zoomed out further than this, the top level places are shown */
  const OVERVIEW_MAX_ZOOM = 8;

  async function ensureOverview(map: MapLibreMap) {
    if (overviewLoaded || !map.getSource("overview")) return;
    const points = await dataClient.getTopLevelPoints();
    if (points.length === 0) return;
    overviewLoaded = true;
    map.getSource<GeoJSONSource>("overview")?.setData({
      type: "FeatureCollection",
      features: points.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
        properties: { label: p.name ?? "Unnamed", href: resolve("/world/[...slug]", { slug: p.slug }) },
      })),
    });
  }

  function getSharedMap() {
    if (shared) return shared;
    const element = document.createElement("div");
    element.className = "size-full";
    const map = new MapLibreMap({
      container: element,
      style: {
        version: 8,
        sources: {
          topo: {
            type: "raster",
            tiles: ["a", "b", "c"].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`),
            tileSize: 256,
            maxzoom: 17,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
          },
        },
        layers: [{ id: "topo", type: "raster", source: "topo" }],
      },
      center: [0, 30],
      zoom: 1.5,
      maxZoom: 22,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("overview", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "overview",
        type: "circle",
        source: "overview",
        maxzoom: OVERVIEW_MAX_ZOOM,
        paint: {
          "circle-radius": 3,
          "circle-color": "#dc2626",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 0.5,
        },
      });
      map.addSource("dots", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "dots",
        type: "circle",
        source: "dots",
        paint: {
          "circle-radius": 4,
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
        },
      });
      const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 8, className: "location-map-popup" });
      for (const layer of ["dots", "overview"]) {
        map.on("mousemove", layer, (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          map.getCanvas().style.cursor = "pointer";
          popup.setLngLat(e.lngLat).setText(feature.properties.label).addTo(map);
        });
        map.on("click", layer, (e) => {
          const href = e.features?.[0]?.properties.href;
          if (href) goto(href);
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
          popup.remove();
        });
      }
    });
    return (shared = { map, element });
  }

  type LocationDot = { lat: number; lon: number; label: string; color?: string; href?: string };

  function setDots(map: MapLibreMap, dots: LocationDot[]) {
    map.getSource<GeoJSONSource>("dots")?.setData({
      type: "FeatureCollection",
      features: dots.map((d) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [d.lon, d.lat] },
        properties: { label: d.label, color: d.color ?? "#2563eb", href: d.href ?? "" },
      })),
    });
  }
</script>

<script lang="ts">
  import { Marker } from "maplibre-gl";
  import { onMount } from "svelte";

  type LocationMarker = {
    lat: number;
    lon: number;
    label?: string;
    color?: string;
    /** Only used with `onmove` */
    draggable?: boolean;
  };

  let {
    markers,
    dots = [],
    zoom = 15,
    class: className = "",
    onmove,
  }: {
    /** The map is centered on the first marker */
    markers: LocationMarker[];
    /** Small dots with their label on hover */
    dots?: LocationDot[];
    zoom?: number;
    class?: string;
    /** Called at the end of a drag of a draggable marker */
    onmove?: (index: number, position: { lat: number; lon: number }) => void;
  } = $props();

  let host: HTMLDivElement;
  let attached = $state(false);
  let drawn: Marker[] = [];
  /** The view does not jump to a position the user just dragged the marker to */
  let dragged: { lat: number; lon: number } | undefined;

  function clear() {
    for (const m of drawn) m.remove();
    drawn = [];
    if (shared?.map.getSource("dots")) setDots(shared.map, []);
  }

  function render() {
    if (!attached) return;
    const { map } = getSharedMap();
    if (!map.getSource("dots")) {
      // The style is not loaded yet
      map.once("load", render);
      return;
    }
    clear();
    setDots(map, dots);
    ensureOverview(map);
    drawn = markers.map((p, i) => {
      const marker = new Marker({ color: p.color ?? "#7c3aed", draggable: !!onmove && !!p.draggable })
        .setLngLat([p.lon, p.lat])
        .addTo(map);
      if (p.label) {
        marker.getElement().setAttribute("aria-label", p.label);
        marker.getElement().title = p.label;
      }
      marker.on("dragend", () => {
        const { lat, lng } = marker.getLngLat();
        dragged = { lat, lon: lng };
        onmove?.(i, dragged);
      });
      return marker;
    });
    const focus = markers[0];
    if (!focus || (dragged?.lat === focus.lat && dragged.lon === focus.lon)) return;
    // Navigating to a place that is already in view keeps the user's position and zoom
    if (positioned && map.getBounds().contains([focus.lon, focus.lat])) return;
    positioned = true;
    map.jumpTo({ center: [focus.lon, focus.lat], zoom });
  }

  onMount(() => {
    const { map, element } = getSharedMap();
    if (height) host.style.height = `${height}px`;
    host.appendChild(element);
    map.resize();
    attached = true;

    return () => {
      clear();
      attached = false;
      // The next page may already have taken the map
      if (element.parentElement === host) element.remove();
    };
  });

  $effect(() => {
    markers;
    dots;
    render();
  });
  function startResize(event: PointerEvent) {
    const handle = event.currentTarget as HTMLElement;
    const startY = event.clientY;
    const startHeight = host.clientHeight;
    handle.setPointerCapture(event.pointerId);
    const move = (e: PointerEvent) => {
      height = Math.max(120, startHeight + e.clientY - startY);
      host.style.height = `${height}px`;
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }
</script>

<div class={className}>
  <div
    bind:this={host}
    class="h-64 w-full md:h-[28rem] overflow-hidden rounded-t-md max-md:rounded-b-md border border-border"
  ></div>
  <div
    role="separator"
    aria-orientation="horizontal"
    aria-label="Resize the map"
    title="Drag to resize the map"
    class="group relative hidden h-4 cursor-row-resize touch-none items-center justify-center rounded-b-md border border-t-0 border-border bg-muted hover:bg-blue-500/20 md:flex"
    onpointerdown={startResize}
  >
    <span class="h-1 w-10 rounded-full bg-muted-foreground/50 group-hover:bg-blue-500"></span>
    <svg
      class="absolute right-1 bottom-1 size-2.5 text-muted-foreground/60 group-hover:text-blue-500"
      viewBox="0 0 10 10"
      aria-hidden="true"
    >
      <path d="M9 1 1 9M9 5 5 9" stroke="currentColor" stroke-width="1" fill="none" stroke-linecap="round" />
    </svg>
  </div>
</div>

<style>
  /* MapLibre popups are white, whatever the theme */
  :global(.location-map-popup .maplibregl-popup-content) {
    background: var(--popover);
    color: var(--popover-foreground);
    padding: 4px 8px;
    font-size: 0.75rem;
  }
  :global(.location-map-popup.maplibregl-popup-anchor-top .maplibregl-popup-tip),
  :global(.location-map-popup.maplibregl-popup-anchor-top-left .maplibregl-popup-tip),
  :global(.location-map-popup.maplibregl-popup-anchor-top-right .maplibregl-popup-tip) {
    border-bottom-color: var(--popover);
  }
  :global(.location-map-popup.maplibregl-popup-anchor-bottom .maplibregl-popup-tip),
  :global(.location-map-popup.maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip),
  :global(.location-map-popup.maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip) {
    border-top-color: var(--popover);
  }
  :global(.location-map-popup.maplibregl-popup-anchor-left .maplibregl-popup-tip) {
    border-right-color: var(--popover);
  }
  :global(.location-map-popup.maplibregl-popup-anchor-right .maplibregl-popup-tip) {
    border-left-color: var(--popover);
  }
</style>
