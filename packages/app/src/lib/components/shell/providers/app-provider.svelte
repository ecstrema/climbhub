<script lang="ts">
  import type { Snippet } from "svelte";
  import AppDataProvider from "./app-data-provider.svelte";
  import GradeProvider from "./settings-provider.svelte";
  import type { DataJSONRecord, DataTree } from "#lib/types.js";

  const {
    children,
    slug,
    currentItem,
    additionalDataJSON,
  }: {
    children: Snippet;
    slug: string | undefined;
    currentItem: DataTree;
    additionalDataJSON: DataJSONRecord;
  } = $props();
</script>

<AppDataProvider {slug} {currentItem} {additionalDataJSON}>
  <GradeProvider>
    {@render children?.()}
  </GradeProvider>
</AppDataProvider>
