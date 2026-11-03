<script lang="ts">
  import EditableName from "#components/editable/editable-name.svelte";
  import EditableDescription from "#lib/components/editable/editable-description.svelte";
  import EditableTags from "#lib/components/editable/editable-tags.svelte";
  import EditableGrade from "#components/editable/editable-grade.svelte";
  import EditableLength from "#components/editable/editable-length.svelte";
  import CommonsTopo from "#lib/components/commons-topo.svelte";
  import type { DataTree } from "#lib/types.js";
  import type { OsmFeature } from "osm-api";
  import { getCoordinates, getGrade } from "#lib/data/parse/osm-tags.js";

  let {
    item = $bindable(),
    slug,
  }: {
    item: DataTree<OsmFeature>;
    slug: string;
  } = $props();

  const feature = $derived(item.feature);

  let coordinates = $derived(getCoordinates(item.feature));
  let grade = $derived(feature.tags ? getGrade(feature.tags) : undefined);
</script>

<div class="flex gap-2 items-baseline">
  <EditableName {feature} featureSlug={slug} />
  <EditableGrade {feature} {grade} featureSlug={slug} />
  <EditableLength {feature} featureSlug={slug} />
</div>

{#if coordinates}
  <p class="text-sm text-muted-foreground">{coordinates.lat}, {coordinates.lon}</p>
{/if}

<EditableDescription {feature} featureSlug={slug} />

<CommonsTopo {feature} featureSlug={slug} />

<EditableTags {feature} featureSlug={slug} />
