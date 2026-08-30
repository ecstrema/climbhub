<script lang="ts">
  import type { BreadcrumbSegment, DataTree } from "$lib/types";

  import AppSidebarNode from "./app-sidebar-node.svelte";
  import { sortChildren } from "./sort-children";

  let {
    item = $bindable(),
    breadcrumbs,
  }: {
    item: DataTree;
    breadcrumbs: BreadcrumbSegment[];
  } = $props();

  const orderedChildren = $derived.by(() => sortChildren(item));
</script>

{#each orderedChildren as slug (slug)}
  {#if item.children?.[slug]}
    <AppSidebarNode bind:item={item.children[slug]} {breadcrumbs} {slug} />
  {:else}
    Failed to get children
  {/if}
{:else}
  No children
{/each}
