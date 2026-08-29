<script lang="ts">
  import EditableTag from "./editable-tag.svelte";
  import type { Tags } from "osm-api";

  let {
    tags = $bindable(),
  }: {
    tags: Tags;
  } = $props();
</script>

<EditableTag source="description" bind:tags placeholder="Enter description..." class="text-sm" />
