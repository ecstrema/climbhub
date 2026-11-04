<script lang="ts">
  import "maplibre-gl/dist/maplibre-gl.css";
  import { Map as MapLibreMap, type GeoJSONSource } from "maplibre-gl";
  import type { Feature } from "geojson";
  import { onMount } from "svelte";

  // Temporary map, drawn while the boundaries load: the editor replaces it once they are all there.
  const { features, version }: { features: Feature[]; version: number } = $props();

  let container: HTMLDivElement;
  let map: MapLibreMap | undefined;
  let ready = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function draw() {
    timer = undefined;
    (map?.getSource("boundaries") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features });
  }

  onMount(() => {
    map = new MapLibreMap({
      container,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [0, 30],
      zoom: 1.5,
      attributionControl: { compact: true },
    });
    map.on("load", () => {
      map!.addSource("boundaries", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map!.addLayer({
        id: "boundaries-fill",
        type: "fill",
        source: "boundaries",
        paint: { "fill-color": "#2563eb", "fill-opacity": 0.12 },
      });
      map!.addLayer({
        id: "boundaries-line",
        type: "line",
        source: "boundaries",
        paint: { "line-color": "#2563eb", "line-width": 0.8 },
      });
      ready = true;
      draw();
    });
    return () => {
      clearTimeout(timer);
      map?.remove();
    };
  });

  // Sending the whole set to the map is slow: at most twice a second
  $effect(() => {
    void version;
    if (ready && timer === undefined) timer = setTimeout(draw, 500);
  });
</script>

<div bind:this={container} class="size-full"></div>
