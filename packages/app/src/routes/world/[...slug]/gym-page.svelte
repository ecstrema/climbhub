<script lang="ts">
  import EditableName from "#components/editable/editable-name.svelte";
  import EditableDescription from "#lib/components/editable/editable-description.svelte";
  import EditableTags from "#lib/components/editable/editable-tags.svelte";
  import CommonsTopo from "#lib/components/commons-topo.svelte";
  import ClimbingStyles from "#components/climbing-styles.svelte";
  import { getCoordinates, getPhone } from "#lib/data/parse/osm-tags.js";
  import type { DataTree } from "#lib/types.js";
  import type { OsmFeature } from "osm-api";
  import BuildingIcon from "@lucide/svelte/icons/building";
  import PhoneIcon from "@lucide/svelte/icons/phone";

  let {
    item = $bindable(),
    slug,
  }: {
    item: DataTree<OsmFeature>;
    slug: string;
  } = $props();

  let coordinates = $derived(getCoordinates(item.feature));
  const feature = $derived(item.feature);
  const phone = $derived(getPhone(feature.tags ?? {}));
</script>

<div class="flex gap-2 items-center">
  <BuildingIcon />
  <EditableName {feature} featureSlug={slug} />
</div>

<ClimbingStyles {feature} />

<p class="flex items-center gap-2 text-sm">
  <PhoneIcon class="size-4 text-muted-foreground" aria-hidden="true" />
  <span class="text-muted-foreground">Phone</span>
  {#if phone}
    <a class="underline underline-offset-2" href={`tel:${phone}`}>{phone}</a>
  {:else}
    <span class="text-muted-foreground">Not listed</span>
  {/if}
</p>

{#if coordinates}
  <p class="text-sm text-muted-foreground">{coordinates.lat}, {coordinates.lon}</p>
{/if}

<EditableDescription {feature} featureSlug={slug} />

<CommonsTopo {feature} featureSlug={slug} />

<EditableTags {feature} featureSlug={slug} />
