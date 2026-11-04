<script lang="ts">
  import "maplibre-gl/dist/maplibre-gl.css";
  import { Map as MapLibreMap, Marker, NavigationControl, LngLatBounds } from "maplibre-gl";
  import { onMount } from "svelte";

  type LocationMarker = { lat: number; lon: number; label?: string };

  let {
    markers,
    zoom = 15,
    class: className = "",
  }: {
    markers: LocationMarker[];
    /** Used when there is a single marker; otherwise the map fits all of them */
    zoom?: number;
    class?: string;
  } = $props();

  let container: HTMLDivElement;
  let map: MapLibreMap | undefined;
  let drawn: Marker[] = [];

  function render() {
    if (!map) return;
    for (const m of drawn) m.remove();
    drawn = markers.map((p) => {
      const marker = new Marker({ color: "#7c3aed" }).setLngLat([p.lon, p.lat]).addTo(map!);
      if (p.label) marker.getElement().setAttribute("aria-label", p.label);
      return marker;
    });
    if (markers.length === 1) {
      map.jumpTo({ center: [markers[0]!.lon, markers[0]!.lat], zoom });
    } else if (markers.length > 1) {
      const bounds = new LngLatBounds();
      for (const p of markers) bounds.extend([p.lon, p.lat]);
      map.fitBounds(bounds, { padding: 40, animate: false, maxZoom: zoom });
    }
  }

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
    render();
    return () => {
      map?.remove();
      map = undefined;
    };
  });

  $effect(() => {
    markers;
    render();
  });
</script>

<div bind:this={container} class="h-64 w-full overflow-hidden rounded-md border border-border {className}"></div>
