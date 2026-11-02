<script lang="ts">
  import EditableDescription from "@/editable/editable-description.svelte";
  import EditableName from "@/editable/editable-name.svelte";
  import ChildrenTable from "./children-table.svelte";
  import EditableTags from "@/editable/editable-tags.svelte";
  import CommonsTopo from "$lib/components/commons-topo.svelte";
  import type { OsmFeature } from "osm-api";
  import type { DataTree } from "$lib/types";

  let {
    item = $bindable(),
    slug,
  }: {
    item: DataTree<OsmFeature>;
    slug: string;
  } = $props();

  let feature = item.feature;
</script>

<EditableName {feature} featureSlug={slug} />
<EditableDescription {feature} featureSlug={slug} />

{#if item.stats?.totalRoutes}
  <p>{item.stats.totalRoutes} routes in total</p>
{/if}

<ChildrenTable bind:item />
<CommonsTopo {feature} featureSlug={slug} />
<EditableTags {feature} featureSlug={slug} />
