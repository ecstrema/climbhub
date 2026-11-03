<script lang="ts">
  import EditableTag from "./editable-tag.svelte";
  import type { OsmFeature } from "osm-api";

  let {
    feature,
    featureSlug,
  }: {
    feature: OsmFeature;
    featureSlug: string;
  } = $props();
</script>

<EditableTag tagKey="description" {feature} {featureSlug} placeholder="Enter description..." class="text-sm" />
