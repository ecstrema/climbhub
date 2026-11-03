<script lang="ts">
  import EditableTags from "#components/editable/editable-tags.svelte";
  import type { DataJSON } from "@climbhub/climbing-data-gen";

  let {
    feature = $bindable(),
    featureSlug,
  }: {
    feature: DataJSON;
    featureSlug: string;
  } = $props();

  console.error("parsing failed for current element", feature);
</script>

Failed to analyze this element.

{#if feature.type !== "geographic"}
  <EditableTags {feature} {featureSlug} />
{/if}
