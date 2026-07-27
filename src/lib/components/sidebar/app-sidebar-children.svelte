<script lang="ts">
  import type { BreadcrumbSegment, DataJSON, RecursiveData } from "$lib/types";

  import AppSidebarNode from "./app-sidebar-node.svelte";

  let {
    children,
    breadcrumbs,
  }: {
    children: RecursiveData<DataJSON>["children"];
    breadcrumbs: BreadcrumbSegment[];
  } = $props();
</script>

{#if children}
  {#each Object.entries(children) as [slug, child] (slug)}
    <AppSidebarNode item={child} {breadcrumbs} {slug} />
  {/each}
{/if}
