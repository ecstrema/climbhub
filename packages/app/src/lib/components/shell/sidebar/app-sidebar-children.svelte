<script lang="ts">
  import type { DataTree } from "$lib/types";
  import { Button } from "@/ui/button";
  import { osmUser } from "../providers";

  import AppSidebarNode from "./app-sidebar-node.svelte";
  import { sortChildren } from "./sort-children";
  import type { OsmRelation, OsmWay } from "osm-api";
  import { featureToType } from "$lib/data";

  let {
    item = $bindable(),
    slug,
  }: {
    item: DataTree;
    slug: string;
  } = $props();

  const orderedChildren = $derived.by(() => sortChildren(item));

  const itemType = $derived(featureToType(item.feature));
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

{#if Object.keys(item.children ?? {}).length === 0}
  <span class="px-4 py-2 text-muted-foreground">No children</span>

  {#if osmUser.loggedIn && itemType === "area"}
    <div class="flex gap-2 self-end">
      <Button
        variant="outline"
        size="xs"
        class="font-normal"
        onclick={() => osmUser.createRoute(item as DataTree<OsmWay | OsmRelation>, slug)}
      >
        Add Route
      </Button>
      <Button
        variant="outline"
        size="xs"
        class="font-normal"
        onclick={() => osmUser.createArea(item as DataTree<OsmWay | OsmRelation>, slug)}
      >
        Add Sector
      </Button>
    </div>
  {/if}
{/if}

{#snippet showItem(slug: string)}
  {#if item.children?.[slug]}
    <AppSidebarNode bind:item={item.children[slug]} {slug} />
  {/if}
{/snippet}
