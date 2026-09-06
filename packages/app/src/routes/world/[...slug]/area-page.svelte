<script lang="ts">
  import EditableDescription from "@/editable/editable-description.svelte";
  import EditableName from "@/editable/editable-name.svelte";
  import ChildrenTable from "./children-table.svelte";
  import EditableTags from "@/editable/editable-tags.svelte";
  import type { OsmFeature } from "osm-api";
  import type { DataTree } from "$lib/types";

  let {
    item = $bindable(),
  }: {
    item: DataTree<OsmFeature>;
  } = $props();

  let feature = $derived(item.feature);
</script>

<EditableName {feature} />
<EditableDescription {feature} />

{#if item.stats?.totalRoutes}
  <p>{item.stats.totalRoutes} routes in total</p>
{/if}

<ChildrenTable bind:item />
<EditableTags {feature} />
