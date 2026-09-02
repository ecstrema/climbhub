<script lang="ts">
  import type { Snippet } from "svelte";
  import OSMProvider from "./osm-provider.svelte";
  import AppDataProvider from "./app-data-provider.svelte";
  import GradeProvider from "./settings-provider.svelte";
  import type { DataJSONRecord, DataTree } from "$lib/types";

  const {
    children,
    slug,
    currentItem,
    parents,
  }: {
    children: Snippet;
    slug: string | undefined;
    currentItem: DataTree;
    parents: DataJSONRecord;
  } = $props();
</script>

<OSMProvider>
  <AppDataProvider {slug} {currentItem} {parents}>
    <GradeProvider>
      {@render children?.()}
    </GradeProvider>
  </AppDataProvider>
</OSMProvider>
