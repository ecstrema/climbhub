<script lang="ts">
  import EditableName from "#components/editable/editable-name.svelte";
  import EditableDescription from "#lib/components/editable/editable-description.svelte";
  import EditableTags from "#lib/components/editable/editable-tags.svelte";
  import EditableGrade from "#components/editable/editable-grade.svelte";
  import EditableLength from "#components/editable/editable-length.svelte";
  import ClimbingStyles from "#components/climbing-styles.svelte";
  import CommonsTopo from "#lib/components/commons-topo.svelte";
  import type { DataTree } from "#lib/types.js";
  import type { OsmFeature } from "osm-api";
  import { getCoordinates, getGrade } from "#lib/data/parse/osm-tags.js";
  import LocationMap from "#lib/components/location-map.svelte";
  import { getAppState } from "#lib/data/app-state.js";
  import { getNearbyDots } from "#lib/data/nearby-dots.js";

  let {
    item = $bindable(),
    slug,
  }: {
    item: DataTree<OsmFeature>;
    slug: string;
  } = $props();

  const feature = $derived(item.feature);

  let coordinates = $derived(getCoordinates(item.feature));
  let grade = $derived(feature.tags ? getGrade(feature.tags) : undefined);
  const appState = getAppState();
  const editable = $derived(appState.osmUser.loggedIn && feature.type === "node");

  const nearby = $derived(getNearbyDots((s) => appState.tree.getReactiveNode(s), slug));
</script>

<div class="flex gap-2 items-baseline">
  <EditableName {feature} featureSlug={slug} />
  <EditableGrade {feature} {grade} featureSlug={slug} />
  <EditableLength {feature} featureSlug={slug} />
</div>

<ClimbingStyles {feature} />

{#if coordinates}
  <p class="text-sm text-muted-foreground">{coordinates.lat}, {coordinates.lon}</p>
  <LocationMap
    markers={[{ ...coordinates, label: feature.tags?.name, draggable: true }]}
    dots={nearby}
    onmove={editable ? (_, position) => appState.setCoordinates(slug, position) : undefined}
  />
  {#if editable}
    <p class="text-xs text-muted-foreground">Drag the marker to move the route.</p>
  {/if}
{/if}

<EditableDescription {feature} featureSlug={slug} />

<CommonsTopo {feature} featureSlug={slug} />

<EditableTags {feature} featureSlug={slug} />
