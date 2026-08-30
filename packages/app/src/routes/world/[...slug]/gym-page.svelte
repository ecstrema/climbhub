<script lang="ts">
  import EditableName from "@/editable/editable-name.svelte";
  import EditableDescription from "$lib/components/editable/editable-description.svelte";
  import EditableTags from "../../../lib/components/editable/editable-tags.svelte";
  import type { DataTree } from "$lib/types";
  import type { OsmFeature } from "osm-api";
  import { getCoordinates } from "$lib/osm-tags";
  import BuildingIcon from "@lucide/svelte/icons/building";

  let {
    item = $bindable(),
  }: {
    item: DataTree<OsmFeature>;
  } = $props();

  let tags = $derived(item.feature.tags || {});
  let coordinates = $derived(getCoordinates(item.feature));
</script>

<div class="flex gap-2 items-center">
  <BuildingIcon />
  <EditableName bind:tags />
</div>

{#if coordinates}
  <p class="text-sm text-muted-foreground">{coordinates.lat}, {coordinates.lon}</p>
{/if}

<EditableDescription bind:tags />

<EditableTags bind:feature={item.feature} />
