<script lang="ts">
  import EditableTags from "@/editable/editable-tags.svelte";
  import type { DataJSON } from "@climbhub/climbing-data-gen";

  let {
    feature = $bindable(),
  }: {
    feature: DataJSON;
  } = $props();

  console.error("parsing failed for current element", feature);
</script>

Failed to analyze this element.

{#if feature.type !== "geographic"}
  <EditableTags bind:feature />
{/if}
