<script lang="ts">
  import type { BreadcrumbSegment, DataTree } from "$lib/types";

  import AppSidebarNode from "./app-sidebar-node.svelte";
  import { sortChildren } from "./sort-children";

  let {
    item = $bindable(),
  }: {
    item: DataTree;
  } = $props();

  const orderedChildren = $derived.by(() => sortChildren(item));
</script>

{#each orderedChildren as slug (slug)}
  {#if item.children?.[slug]}
    <AppSidebarNode bind:item={item.children[slug]} {slug} />
  {:else}
    Failed to get children
  {/if}
{:else}
  No children
{/each}
