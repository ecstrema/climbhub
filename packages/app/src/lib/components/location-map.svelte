<script module lang="ts">
  import "maplibre-gl/dist/maplibre-gl.css";
  import { Map as MapLibreMap, Marker, NavigationControl, Popup, type GeoJSONSource } from "maplibre-gl";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { dataClient } from "#lib/data/network/data-client.js";
  import { localDb } from "#lib/data/db/local-db.svelte.js";
  import type { MapElementFeature, MapElementFeatureCollection } from "#lib/data/db/types.js";
  import { FEATURE_COLORS } from "#lib/data/parse/route-styles.js";
  import type { OsmFeature } from "osm-api";
  import { CLIMBING_LAYERS, featureToMapElement, formatPopupHtml, VECTOR_STYLE } from "./location-map-helper.js";

  // One map (and WebGL context) for the whole app: kept across page navigation.
  let shared: { map: MapLibreMap; element: HTMLDivElement } | undefined;
  let dragMarker: Marker | undefined;
  let currentOnmove: ((position: { lat: number; lon: number }) => void) | undefined;
  /** Kept across pages, as the user can resize the map */
  let height: number | undefined;
  /** False until the view was first set to a place */
  let positioned = false;
  let allElementsLoaded = false;
  let cachedCollection: MapElementFeatureCollection = { type: "FeatureCollection", features: [] };
  const loadedSlugs = new Set<string>();
  let sharedColorMode: "grade" | "type" | "both" = "both";

  function setMarkerPosition(coords: { lat: number; lon: number }, draggable = false) {
    if (!shared) return;
    const map = shared.map;
    if (dragMarker) {
      dragMarker.setLngLat([coords.lon, coords.lat]);
      dragMarker.setDraggable(draggable);
    } else {
      dragMarker = new Marker({ color: "#2563eb", draggable }).setLngLat([coords.lon, coords.lat]).addTo(map);

      dragMarker.on("dragend", () => {
        if (dragMarker && currentOnmove) {
          const lngLat = dragMarker.getLngLat();
          currentOnmove({ lat: lngLat.lat, lon: lngLat.lng });
        }
      });
    }
  }

  function applyColorMode(map: MapLibreMap, mode: "grade" | "type" | "both") {
    if (!map.isStyleLoaded() || !map.getLayer("routes")) return;
    if (mode === "grade") {
      map.setPaintProperty("routes", "circle-color", ["get", "fillColor"]);
      map.setPaintProperty("routes", "circle-stroke-color", "#ffffff");
      map.setPaintProperty("routes", "circle-stroke-width", 1.5);
    } else if (mode === "type") {
      map.setPaintProperty("routes", "circle-color", ["get", "strokeColor"]);
      map.setPaintProperty("routes", "circle-stroke-color", "#ffffff");
      map.setPaintProperty("routes", "circle-stroke-width", 1.5);
    } else {
      map.setPaintProperty("routes", "circle-color", ["get", "fillColor"]);
      map.setPaintProperty("routes", "circle-stroke-color", ["get", "strokeColor"]);
      map.setPaintProperty("routes", "circle-stroke-width", [
        "interpolate",
        ["linear"],
        ["zoom"],
        8,
        1,
        14,
        1.5,
        17,
        2,
      ]);
    }
  }

  function setElementsSourceData(map: MapLibreMap, collection: MapElementFeatureCollection) {
    const source = map.getSource<GeoJSONSource>("climbing-elements");
    if (!source) return;
    source.setData(collection);
  }

  async function loadMapElements(map: MapLibreMap) {
    if (allElementsLoaded) return;

    if (localDb.ready) {
      const data = await localDb.getAllMapElements();
      if (data && data.features.length > 0) {
        for (const f of data.features) {
          f.properties.href = resolve("/world/[...slug]", { slug: f.properties.slug });
          loadedSlugs.add(f.properties.slug);
        }
        cachedCollection = data;
        allElementsLoaded = true;
        setElementsSourceData(map, cachedCollection);
        return;
      }
    }

    const points = await dataClient.getTopLevelPoints();
    if (points.length > 0 && cachedCollection.features.length === 0) {
      cachedCollection = {
        type: "FeatureCollection",
        features: points.map((p) => {
          loadedSlugs.add(p.slug);
          return {
            type: "Feature",
            geometry: { type: "Point", coordinates: [p.lon, p.lat] },
            properties: {
              slug: p.slug,
              name: p.name ?? "Unnamed",
              elementType: "area",
              fillColor: FEATURE_COLORS.area.fill,
              strokeColor: FEATURE_COLORS.area.stroke,
              href: resolve("/world/[...slug]", { slug: p.slug }),
            },
          };
        }),
      };
      setElementsSourceData(map, cachedCollection);
    }
  }

  function updateOrAddElement(map: MapLibreMap, slug: string, feature: OsmFeature) {
    const existingIndex = cachedCollection.features.findIndex((f) => f.properties.slug === slug);
    const existingFeature = existingIndex >= 0 ? cachedCollection.features[existingIndex] : undefined;
    if (existingFeature && existingFeature.properties.elementType === "sector") {
      // Do not overwrite an existing sector contour with an area point!
      if (feature.tags?.name) {
        existingFeature.properties.name = feature.tags.name;
        setElementsSourceData(map, cachedCollection);
      }
      return;
    }
    const element = featureToMapElement(slug, feature);
    if (!element) return;
    if (existingIndex >= 0) {
      cachedCollection.features[existingIndex] = element;
    } else {
      loadedSlugs.add(slug);
      cachedCollection.features.push(element);
    }
    setElementsSourceData(map, cachedCollection);
  }

  function updateElementCoordinates(map: MapLibreMap, slug: string, coords: { lat: number; lon: number }) {
    const existing = cachedCollection.features.find((f) => f.properties.slug === slug);
    if (existing && existing.geometry.type === "Point") {
      const [curLon, curLat] = existing.geometry.coordinates;
      if (curLon !== coords.lon || curLat !== coords.lat) {
        existing.geometry.coordinates = [coords.lon, coords.lat];
        setElementsSourceData(map, cachedCollection);
      }
    }
  }

  function getSharedMap() {
    if (shared) return shared;
    const element = document.createElement("div");
    element.className = "size-full";
    const map = new MapLibreMap({
      container: element,
      style: VECTOR_STYLE,
      center: [0, 30],
      zoom: 1.5,
      maxZoom: 22,
      maxTileCacheSize: 200,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    if (typeof window !== "undefined") (window as any).__maplibre = map;
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      // Hide basemap climbing POIs so vector tiles do not duplicate or conflict with our data
      for (const layer of map.getStyle().layers || []) {
        const l = layer as { id: string; "source-layer"?: string; filter?: any[] };
        if (l["source-layer"] === "poi") {
          const filter = Array.isArray(l.filter) ? l.filter : ["all"];
          map.setFilter(l.id, [
            "all",
            filter,
            ["!=", ["get", "class"], "sport"],
            ["!=", ["get", "subclass"], "climbing"],
          ] as any);
        }
      }

      map.addSource("climbing-elements", {
        type: "geojson",
        data: cachedCollection,
        tolerance: 0.5,
      });

      for (const layer of CLIMBING_LAYERS) {
        if (!map.getLayer(layer.id)) {
          map.addLayer(layer);
        }
      }

      applyColorMode(map, sharedColorMode);

      const popup = new Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 8,
        className: "location-map-popup",
      });

      const interactiveLayers = [
        "routes",
        "cliffs",
        "areas",
        "gyms",
        "sectors-contour",
        "sectors-label",
        "route-labels",
        "selected-sector",
        "selected-sector-label",
      ];
      for (const layer of interactiveLayers) {
        map.on("mousemove", layer, (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          map.getCanvas().style.cursor = "pointer";
          const props = feature.properties as MapElementFeature["properties"];
          popup.setLngLat(e.lngLat).setHTML(formatPopupHtml(props)).addTo(map);
        });

        map.on("click", layer, (e) => {
          const feature = e.features?.[0];
          if (!feature) return;

          if (feature.geometry.type === "Point") {
            const [lon, lat] = feature.geometry.coordinates as [number, number];
            setMarkerPosition({ lon, lat });
          }

          const href = feature.properties?.href;
          if (href) goto(href);
        });

        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
          popup.remove();
        });
      }

      void loadMapElements(map);
    });

    return (shared = { map, element });
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import type { GeographicFolderElement } from "@climbhub/climbing-data-gen";
  import MapLegend from "./map-legend.svelte";

  let {
    currentSlug = "",
    currentFeature,
    coordinates,
    bounds,
    draggable = false,
    zoom = 15,
    class: className = "",
    onmove,
  }: {
    currentSlug?: string;
    currentFeature?: OsmFeature | GeographicFolderElement | undefined;
    coordinates?: { lat: number; lon: number } | undefined;
    bounds?: { x0: number; x1: number; y0: number; y1: number } | undefined;
    draggable?: boolean;
    zoom?: number;
    class?: string;
    onmove?: (position: { lat: number; lon: number }) => void;
  } = $props();

  let host: HTMLDivElement;
  let attached = $state(false);
  let colorMode = $state<"grade" | "type" | "both">(sharedColorMode);

  function updateActiveHighlight(slug: string) {
    if (!shared?.map) return;
    const cleanSlug = slug.replace(/^world\//, "");
    if (shared.map.getLayer("selected-ring")) {
      shared.map.setFilter("selected-ring", [
        "in",
        ["get", "slug"],
        ["literal", [slug, cleanSlug, `world/${cleanSlug}`]],
      ]);
    }
    if (shared.map.getLayer("selected-sector")) {
      shared.map.setFilter("selected-sector", [
        "all",
        ["==", ["get", "elementType"], "sector"],
        ["in", ["get", "slug"], ["literal", [slug, cleanSlug, `world/${cleanSlug}`]]],
      ]);
    }
    if (shared.map.getLayer("selected-sector-label")) {
      shared.map.setFilter("selected-sector-label", [
        "all",
        ["==", ["get", "elementType"], "sector"],
        ["in", ["get", "slug"], ["literal", [slug, cleanSlug, `world/${cleanSlug}`]]],
      ]);
    }
  }

  function moveToTarget() {
    if (!attached || !shared) return;
    const map = shared.map;

    if (bounds) {
      positioned = true;
      map.fitBounds(
        [
          [bounds.x0, bounds.y0],
          [bounds.x1, bounds.y1],
        ],
        { padding: 40, maxZoom: 16, duration: 600 },
      );
      return;
    }

    if (!coordinates) return;

    if (positioned && map.getBounds().contains([coordinates.lon, coordinates.lat])) {
      map.easeTo({ center: [coordinates.lon, coordinates.lat], duration: 500 });
      return;
    }

    positioned = true;
    map.flyTo({
      center: [coordinates.lon, coordinates.lat],
      zoom: Math.max(map.getZoom(), zoom),
      duration: 700,
    });
  }

  function getEffectiveCoordinates(): { lat: number; lon: number } | undefined {
    if (coordinates) return coordinates;
    if (!currentSlug) return undefined;
    const cleanSlug = currentSlug.replace(/^world\//, "");
    const feat = cachedCollection.features.find(
      (f) =>
        f.properties.slug === currentSlug ||
        f.properties.slug === cleanSlug ||
        f.properties.slug === `world/${cleanSlug}`,
    );
    if (!feat) return undefined;
    if (feat.geometry.type === "Point") {
      const [lon, lat] = feat.geometry.coordinates as [number, number];
      return { lat, lon };
    }
    if (feat.geometry.type === "LineString" && feat.geometry.coordinates.length > 0) {
      const coords = feat.geometry.coordinates as [number, number][];
      const lon = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
      const lat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
      return { lat, lon };
    }
    return undefined;
  }

  function updateDraggableMarker() {
    if (!attached || !shared) return;
    currentOnmove = onmove;
    const coords = getEffectiveCoordinates();

    if (!coords) {
      if (dragMarker) {
        dragMarker.remove();
        dragMarker = undefined;
      }
      return;
    }

    setMarkerPosition(coords, Boolean(draggable && onmove));
  }

  onMount(() => {
    const { map, element } = getSharedMap();
    if (typeof window !== "undefined") (window as any).__maplibre = map;
    if (height) host.style.height = `${height}px`;
    host.appendChild(element);
    map.resize();
    attached = true;

    const onMapReady = () => {
      void loadMapElements(map);
      moveToTarget();
      updateActiveHighlight(currentSlug);
      updateDraggableMarker();
      applyColorMode(map, colorMode);
    };

    if (map.getLayer("routes")) {
      onMapReady();
    } else {
      map.once("load", () => {
        onMapReady();
      });
    }

    return () => {
      attached = false;
      if (element.parentElement === host) element.remove();
    };
  });

  // Watch for localDb becoming ready to load all elements
  $effect(() => {
    if (localDb.ready && shared?.map && !allElementsLoaded) {
      void loadMapElements(shared.map);
    }
  });

  // Add or update current feature if downloaded or updated upstream
  $effect(() => {
    if (currentSlug && currentFeature && currentFeature.type !== "geographic" && shared?.map) {
      updateOrAddElement(shared.map, currentSlug, currentFeature as OsmFeature);
    }
  });

  // Ensure dot position synchronizes with updated coordinates (e.g. after redownload upstream)
  $effect(() => {
    if (currentSlug && coordinates && shared?.map) {
      updateElementCoordinates(shared.map, currentSlug, coordinates);
    }
  });

  // React to target position / bounds / slug change
  $effect(() => {
    coordinates;
    bounds;
    currentSlug;
    if (attached && shared?.map) {
      moveToTarget();
      updateDraggableMarker();
      updateActiveHighlight(currentSlug);
    }
  });

  // Dynamically update route circle color mode (grade, type, both)
  $effect(() => {
    sharedColorMode = colorMode;
    if (attached && shared?.map) {
      applyColorMode(shared.map, colorMode);
    }
  });

  function startResize(event: PointerEvent) {
    const handle = event.currentTarget as HTMLElement;
    const startY = event.clientY;
    const startHeight = host.clientHeight;
    handle.setPointerCapture(event.pointerId);
    const move = (e: PointerEvent) => {
      height = Math.max(160, startHeight + e.clientY - startY);
      host.style.height = `${height}px`;
      shared?.map.resize();
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

<div class={`relative ${className}`}>
  <div
    bind:this={host}
    class="relative h-72 w-full md:h-[28rem] overflow-hidden rounded-t-md max-md:rounded-b-md border border-border"
  >
    <MapLegend bind:colorMode />
  </div>
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
