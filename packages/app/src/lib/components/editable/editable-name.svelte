<script lang="ts">
  import type { Tags } from "osm-api";
  import EditableTag from "./editable-tag.svelte";

  let {
    tags = $bindable(),
  }: {
    tags: Tags;
  } = $props();
</script>

<EditableTag source="name" bind:tags placeholder="Enter Name..." class="text-2xl font-semibold" />
