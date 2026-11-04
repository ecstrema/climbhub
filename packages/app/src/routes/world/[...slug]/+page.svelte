<script lang="ts">
  import ComponentParseFailed from "./component-parse-failed.svelte";
  import GeographicPage from "./geographic-page.svelte";
  import AreaPage from "./area-page.svelte";
  import GymPage from "./gym-page.svelte";
  import RoutePage from "./route-page.svelte";
  import type { GeographicFolderElement } from "@climbhub/climbing-data-gen";
  import type { DataTree } from "#lib/types.js";
  import { featureToType } from "#lib/data/parse/data.js";
  import type { OsmFeature } from "osm-api";
  import type { PageProps } from "./$types";
  import OsmMissingFeature from "#components/shell/osm-missing-feature.svelte";
  import { getStaticIdentifier } from "@climbhub/common";
  import { getAppState } from "#lib/data/app-state.js";
  import { afterNavigate, replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import { untrack } from "svelte";

  let { params }: PageProps = $props();

  const slug = $derived(params.slug);

  const appState = getAppState();

  let queriedItem = $state<{ item: DataTree<OsmFeature>; slug: string }>();
  let lastQueryId: string | null | undefined;
  $effect(() => {
    const id = page.url.searchParams.get("id");
    // The tree walk must not subscribe this effect to every node
    const found = untrack(() => {
      if (!id) return undefined;
      const feature = appState.currentNode.current.feature;
      if (feature.type !== "geographic" && `${feature.type}-${feature.id}` === id) return undefined;
      return appState.findOsmItemById(id);
    });
    if (found) queriedItem = found;
    else if (id !== lastQueryId) queriedItem = undefined;
    lastQueryId = id;
  });
  let item = $derived(queriedItem?.item ?? appState.currentNode.current);
  const itemSlug = $derived(queriedItem?.slug ?? slug);
  const itemType = $derived(featureToType(item.feature));

  // Shared links carry the OSM id so the item can be found if its path changes.
  // Not an effect: replaceState updates page.url, which would re-trigger it.
  afterNavigate(() => {
    untrack(() => {
      if (item.feature.type === "geographic") return;
      const id = `${item.feature.type}-${item.feature.id}`;
      if (page.url.searchParams.get("id") === id && !page.url.searchParams.has("osm")) return;
      const url = new URL(page.url.href);
      url.searchParams.delete("osm");
      url.searchParams.set("id", id);
      replaceState(url, page.state);
    });
  });

  const isFeatureDeletedUpstream = $derived.by(() => {
    if (item.feature.type === "geographic") return false;

    const identifier = getStaticIdentifier(item.feature.type, item.feature.id);
    const refreshedFeatureState = appState.osmUser.refreshedFeatureStates[identifier];
    if (refreshedFeatureState === "pending") return false;

    if (!refreshedFeatureState) return false;

    return refreshedFeatureState.refreshedFeature === undefined;
  });
</script>

{#if item.feature.type !== "geographic" && isFeatureDeletedUpstream}
  <OsmMissingFeature feature={item.feature} />
{/if}

{#if !itemType}
  <ComponentParseFailed feature={item.feature} featureSlug={slug} />
{:else if itemType === "geographic"}
  <GeographicPage bind:item={item as DataTree<GeographicFolderElement>} />
{:else if itemType === "area"}
  <AreaPage bind:item={item as DataTree<OsmFeature>} slug={itemSlug} />
{:else if itemType === "route"}
  <RoutePage bind:item={item as DataTree<OsmFeature>} slug={itemSlug} />
{:else if itemType === "gym"}
  <GymPage bind:item={item as DataTree<OsmFeature>} slug={itemSlug} />
{:else}
  <ComponentParseFailed feature={item.feature} featureSlug={itemSlug} />
{/if}
