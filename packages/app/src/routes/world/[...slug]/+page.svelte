<script lang="ts">
  import Component404 from "./component404.svelte";
  import GeographicPage from "./geographic-page.svelte";
  import AreaPage from "./area-page.svelte";
  import RoutePage from "./route-page.svelte";
  import { getProcessedData } from "@/shell/providers/app-data.svelte";

  const data = $derived(getProcessedData().current);
</script>

{#if data}
  {#if data.type === "geographic"}
    <GeographicPage />
  {:else if data.type === "area"}
    <AreaPage />
  {:else if data.type === "route"}
    <RoutePage />
  {/if}
{:else}
  <Component404 />
{/if}
