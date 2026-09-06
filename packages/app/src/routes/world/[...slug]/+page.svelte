<script lang="ts">
  import ComponentParseFailed from "./component-parse-failed.svelte";
  import GeographicPage from "./geographic-page.svelte";
  import AreaPage from "./area-page.svelte";
  import GymPage from "./gym-page.svelte";
  import RoutePage from "./route-page.svelte";
  import { getCurrentNode } from "@/shell/providers/app-data.svelte";
  import type { GeographicFolderElement } from "@climbhub/climbing-data-gen";
  import type { DataTree } from "$lib/types";
  import { featureToType } from "$lib/data";
  import type { OsmFeature } from "osm-api";
  import { resolve } from "$app/paths";
  import type { PageProps } from "./$types";
  import { getOsmUser } from "@/shell/providers";
  import OsmMissingFeature from "@/shell/osm-missing-feature.svelte";
  import { getStaticIdentifier } from "@climbhub/common";

  let { params }: PageProps = $props();

  let item = $derived(getCurrentNode().current);
  const itemType = $derived(featureToType(item.feature));

  const osmUser = getOsmUser();

  const isFeatureDeletedUpstream = $derived.by(() => {
    if (item.feature.type === "geographic") return false;

    const identifier = getStaticIdentifier(item.feature.type, item.feature.id);
    const refreshedFeatureState = osmUser.refreshedFeatureStates[identifier];
    if (refreshedFeatureState === "pending") return false;

    if (!refreshedFeatureState) return false;

    return refreshedFeatureState.refreshedFeature === undefined;
  });
</script>

{#if item.feature.type !== "geographic" && isFeatureDeletedUpstream}
  <OsmMissingFeature feature={item.feature} />
{/if}

{#if !itemType}
  <ComponentParseFailed feature={item.feature} />
{:else if itemType === "geographic"}
  <GeographicPage bind:item={item as DataTree<GeographicFolderElement>} />
{:else if itemType === "area"}
  <AreaPage bind:item={item as DataTree<OsmFeature>} />
{:else if itemType === "route"}
  <RoutePage bind:item={item as DataTree<OsmFeature>} />
{:else if itemType === "gym"}
  <GymPage bind:item={item as DataTree<OsmFeature>} />
{:else}
  <ComponentParseFailed feature={item.feature} />
{/if}

<!-- TODO: We need this else sveltekit complains that some endpoints are never used. -->
<a class="hidden" href={resolve("/api/world/[...slug]/deep.json", { slug: params.slug })}>
  Download
</a>
<a class="hidden" href={resolve("/api/world/[...slug]/stats.json", { slug: params.slug })}>
  Stats
</a>
<a class="hidden" href={resolve("/api/world/[...slug]/data.json", { slug: params.slug })}> Data </a>
