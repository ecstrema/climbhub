<script lang="ts">
  import type { DataTree } from "#lib/types.js";
  import { Button } from "#components/ui/button/index.js";

  import AppSidebarNode from "./app-sidebar-node.svelte";
  import { getSearchFilter, getSidebarChildren } from "./utils";
  import type { OsmRelation, OsmWay } from "osm-api";
  import { featureToType } from "#lib/data/parse/data.js";
  import { getAppState } from "#lib/data/app-state.js";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";

  let {
    item = $bindable(),
    slug,
  }: {
    item: DataTree;
    slug: string;
  } = $props();

  const orderedChildren = $derived.by(() => getSidebarChildren(item, slug));

  const itemType = $derived(featureToType(item.feature));

  const searchFilter = getSearchFilter();

  const appState = getAppState();

  async function addRoute() {
    const newSlug = appState.createRoute(item as DataTree<OsmWay | OsmRelation>, slug);
    await goto(resolve("/world/[...slug]", { slug: newSlug }));
  }

  async function addSector() {
    const newSlug = appState.createArea(item as DataTree<OsmWay | OsmRelation>, slug);
    await goto(resolve("/world/[...slug]", { slug: newSlug }));
  }
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

  {#if appState.osmUser.loggedIn && itemType === "area"}
    <div class="flex gap-2 self-end">
      <Button variant="outline" size="xs" class="font-normal" onclick={addRoute}>Add Route</Button>
      <Button variant="outline" size="xs" class="font-normal" onclick={addSector}>Add Sector</Button>
    </div>
  {/if}
{/if}

{#snippet showItem(slug: string)}
  {let child = item.children?.[slug]}
  {#if child && searchFilter.current.matches(slug, child)}
    <AppSidebarNode bind:item={child} {slug} />
  {/if}
{/snippet}
