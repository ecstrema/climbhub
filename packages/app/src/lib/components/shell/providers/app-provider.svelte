<script lang="ts">
  import type { Snippet } from "svelte";
  import OSMProvider from "./osm-provider.svelte";
  import AppDataProvider from "./app-data-provider.svelte";
  import GradeProvider from "./settings-provider.svelte";
  import type { DataJSONRecord } from "$lib/types";

  const {
    children,
    slug,
    elements,
  }: {
    children: Snippet;
    slug: string | undefined;
    elements: DataJSONRecord;
  } = $props();
</script>

<OSMProvider>
  <AppDataProvider {slug} {elements}>
    <GradeProvider>
      {@render children?.()}
    </GradeProvider>
  </AppDataProvider>
</OSMProvider>
