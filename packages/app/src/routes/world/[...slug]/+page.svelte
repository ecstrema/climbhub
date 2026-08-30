<script lang="ts">
  import ComponentParseFailed from "./component-parse-failed.svelte";
  import GeographicPage from "./geographic-page.svelte";
  import AreaPage from "./area-page.svelte";
  import GymPage from "./gym-page.svelte";
  import RoutePage from "./route-page.svelte";
  import { getCurrentNode } from "@/shell/providers/app-data.svelte";
  import type { GeographicFolderElement } from "@climbhub/climbing-data-gen";
  import type { DataTree } from "$lib/types";
  import { featureToType } from "$lib/data";
  import type { OsmFeature } from "osm-api";

  let item = $derived(getCurrentNode().current);
  const itemType = $derived(featureToType(item.feature));
</script>

{#if !itemType}
  <ComponentParseFailed bind:feature={item.feature} />
{:else if itemType === "geographic"}
  <GeographicPage bind:item={item as DataTree<GeographicFolderElement>} />
{:else if itemType === "area"}
  <AreaPage bind:item={item as DataTree<OsmFeature>} />
{:else if itemType === "route"}
  <RoutePage bind:item={item as DataTree<OsmFeature>} />
{:else if itemType === "gym"}
  <GymPage bind:item={item as DataTree<OsmFeature>} />
{:else}
  <ComponentParseFailed bind:feature={item.feature} />
{/if}
