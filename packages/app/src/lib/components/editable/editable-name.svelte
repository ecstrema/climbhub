<script lang="ts">
  import type { OsmFeature, Tags } from "osm-api";
  import EditableTag from "./editable-tag.svelte";

  let {
    feature,
  }: {
    feature: OsmFeature;
  } = $props();
</script>

<EditableTag tagKey="name" {feature} placeholder="Enter Name..." class="text-2xl font-semibold" />
