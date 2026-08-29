<script lang="ts">
  import EditableTags from "@/editable/editable-tags.svelte";
  import type { DataJSON } from "@climbhub/climbing-data-gen";

  console.error("parsing failed for current element");

  let {
    feature = $bindable(),
  }: {
    feature: DataJSON;
  } = $props();
</script>

Failed to analyze this element.

{#if feature.type !== "geographic"}
  <EditableTags bind:feature />
{/if}
