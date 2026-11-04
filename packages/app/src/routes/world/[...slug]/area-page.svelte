<script lang="ts">
  import EditableDescription from "#components/editable/editable-description.svelte";
  import EditableName from "#components/editable/editable-name.svelte";
  import ChildrenTable from "./children-table.svelte";
  import EditableTags from "#components/editable/editable-tags.svelte";
  import ClimbingStyles from "#components/climbing-styles.svelte";
  import CommonsTopo from "#lib/components/commons-topo.svelte";
  import type { OsmFeature } from "osm-api";
  import type { DataTree } from "#lib/types.js";
  import LocationMap from "#lib/components/location-map.svelte";
  import { getAppState } from "#lib/data/app-state.js";
  import { getCoordinates } from "#lib/data/parse/osm-tags.js";
  import { getNearbyDots } from "#lib/data/nearby-dots.js";

  let {
    item = $bindable(),
    slug,
  }: {
    item: DataTree<OsmFeature>;
    slug: string;
  } = $props();

  let feature = item.feature;
  const appState = getAppState();
  const coordinates = $derived.by(() => {
    const own = getCoordinates(item.feature);
    if (own) return own;
    // Areas mapped without a position are placed at the center of what they contain
    const inside = nearby.filter((d) => d.slug.startsWith(`${slug}/`));
    if (inside.length === 0) return undefined;
    return {
      lat: inside.reduce((sum, d) => sum + d.lat, 0) / inside.length,
      lon: inside.reduce((sum, d) => sum + d.lon, 0) / inside.length,
    };
  });
  const nearby = $derived(getNearbyDots((s) => appState.tree.getReactiveNode(s), slug));
</script>

<EditableName {feature} featureSlug={slug} />
<ClimbingStyles feature={item.feature} />
<EditableDescription {feature} featureSlug={slug} />

{#if item.stats?.totalRoutes}
  <p>{item.stats.totalRoutes} routes in total</p>
{/if}

{#if coordinates}
  <LocationMap markers={[{ ...coordinates, label: feature.tags?.name }]} dots={nearby} zoom={13} />
{/if}

<ChildrenTable bind:item />
<CommonsTopo {feature} featureSlug={slug} />
<EditableTags {feature} featureSlug={slug} />
