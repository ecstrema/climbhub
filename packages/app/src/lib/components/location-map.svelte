<script lang="ts">
  import "maplibre-gl/dist/maplibre-gl.css";
  import { Map as MapLibreMap, Marker, NavigationControl, LngLatBounds } from "maplibre-gl";
  import { onMount } from "svelte";

  type LocationMarker = { lat: number; lon: number; label?: string };

  let {
    markers,
    zoom = 15,
    class: className = "",
    onmove,
  }: {
    markers: LocationMarker[];
    /** Used when there is a single marker; otherwise the map fits all of them */
    zoom?: number;
    class?: string;
    /** When set, the markers are draggable: called at the end of a drag */
    onmove?: (index: number, position: { lat: number; lon: number }) => void;
  } = $props();

  let container: HTMLDivElement;
  let map: MapLibreMap | undefined;
  let drawn: Marker[] = [];
  /** The view does not jump to a position the user just dragged the marker to */
  let dragged: { lat: number; lon: number } | undefined;

  function render() {
    if (!map) return;
    for (const m of drawn) m.remove();
    drawn = markers.map((p, i) => {
      const marker = new Marker({ color: "#7c3aed", draggable: !!onmove }).setLngLat([p.lon, p.lat]).addTo(map!);
      if (p.label) marker.getElement().setAttribute("aria-label", p.label);
      marker.on("dragend", () => {
        const { lat, lng } = marker.getLngLat();
        dragged = { lat, lon: lng };
        onmove?.(i, dragged);
      });
      return marker;
    });
    if (markers.length === 1) {
      const p = markers[0]!;
      if (dragged?.lat === p.lat && dragged.lon === p.lon) return;
      map.jumpTo({ center: [p.lon, p.lat], zoom });
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
