<script lang="ts">
  import type { Snippet } from "svelte";
  import type { DataJSON } from "climbing-data-gen";
  import OSMProvider from "./osm-provider.svelte";
  import AppDataProvider from "./app-data-provider.svelte";
  import GradeProvider from "./grade-provider.svelte";

  const {
    children,
    slug,
    elements,
  }: {
    children: Snippet;
    slug: string | undefined;
    elements: Record<string, DataJSON>;
  } = $props();
</script>

<OSMProvider>
  <AppDataProvider {slug} {elements}>
    <GradeProvider>
      {@render children?.()}
    </GradeProvider>
  </AppDataProvider>
</OSMProvider>
