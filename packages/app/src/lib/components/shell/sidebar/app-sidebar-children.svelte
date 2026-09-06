<script lang="ts">
  import { recordOfArrayIterator } from "$lib/iterators";
  import type { DataTree } from "$lib/types";

  import AppSidebarNode from "./app-sidebar-node.svelte";
  import { sortChildren } from "./sort-children";

  let {
    item = $bindable(),
  }: {
    item: DataTree;
  } = $props();

  const orderedChildren = $derived.by(() => sortChildren(item));
</script>

{#each orderedChildren?.geographic as slug (slug)}
  {@render showItem(slug)}
{/each}

{#each orderedChildren?.area as slug (slug)}
  {@render showItem(slug)}
{/each}

{#each orderedChildren?.gym as slug (slug)}
  {@render showItem(slug)}
{/each}

{#each orderedChildren?.route as slug (slug)}
  {@render showItem(slug)}
{/each}

{#each orderedChildren?.other as slug (slug)}
  {@render showItem(slug)}
{/each}

{#snippet showItem(slug: string)}
  {#if item.children?.[slug]}
    <AppSidebarNode bind:item={item.children[slug]} {slug} />
  {:else}
    Failed to get children
  {/if}
{/snippet}
