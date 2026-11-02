<script lang="ts">
  import EditableName from "@/editable/editable-name.svelte";
  import EditableDescription from "$lib/components/editable/editable-description.svelte";
  import EditableTags from "$lib/components/editable/editable-tags.svelte";
  import CommonsTopo from "$lib/components/commons-topo.svelte";
  import type { DataTree } from "$lib/types";
  import type { OsmFeature } from "osm-api";
  import { getCoordinates } from "$lib/data/parse/osm-tags";
  import BuildingIcon from "@lucide/svelte/icons/building";

  let {
    item = $bindable(),
    slug,
  }: {
    item: DataTree<OsmFeature>;
    slug: string;
  } = $props();

  let coordinates = $derived(getCoordinates(item.feature));
  const feature = $derived(item.feature);
</script>

<div class="flex gap-2 items-center">
  <BuildingIcon />
  <EditableName {feature} featureSlug={slug} />
</div>

{#if coordinates}
  <p class="text-sm text-muted-foreground">{coordinates.lat}, {coordinates.lon}</p>
{/if}

<EditableDescription {feature} featureSlug={slug} />

<CommonsTopo {feature} featureSlug={slug} />

<EditableTags {feature} featureSlug={slug} />
