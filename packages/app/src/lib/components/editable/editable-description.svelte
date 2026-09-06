<script lang="ts">
  import EditableTag from "./editable-tag.svelte";
  import type { Tags } from "osm-api";
  import type { OsmFeature } from "osm-api";

  let {
    feature,
  }: {
    feature: OsmFeature;
  } = $props();
</script>

<EditableTag tagKey="description" {feature} placeholder="Enter description..." class="text-sm" />
