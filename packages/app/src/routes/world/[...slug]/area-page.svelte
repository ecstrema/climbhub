<script lang="ts">
  import EditableDescription from "#components/editable/editable-description.svelte";
  import EditableName from "#components/editable/editable-name.svelte";
  import ChildrenTable from "./children-table.svelte";
  import EditableTags from "#components/editable/editable-tags.svelte";
  import ClimbingStyles from "#components/climbing-styles.svelte";
  import CommonsTopo from "#lib/components/commons-topo.svelte";
  import type { OsmFeature } from "osm-api";
  import type { DataTree } from "#lib/types.js";

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
<ClimbingStyles feature={item.feature} />
<EditableDescription {feature} featureSlug={slug} />

{#if item.stats?.totalRoutes}
  <p>{item.stats.totalRoutes} routes in total</p>
{/if}

<ChildrenTable bind:item />
<CommonsTopo {feature} featureSlug={slug} />
<EditableTags {feature} featureSlug={slug} />
