<script lang="ts">
  import { getAppState } from "#lib/data/app-state.js";
  import EditableTextarea from "./editable-textarea.svelte";
  import type { OsmFeature } from "osm-api";
  import type { ComponentProps } from "svelte";

  const {
    tagKey,
    feature,
    featureSlug,
    ...props
  }: {
    tagKey: OsmApi.Keys["keys"];
    feature: OsmFeature;
    featureSlug: string;
  } & ComponentProps<typeof EditableTextarea> = $props();

  const appState = getAppState();

  const tags = $derived(feature.tags ?? {});
</script>

<EditableTextarea
  bind:value={() => tags[tagKey], (v) => appState.setTag(featureSlug, tagKey, v)}
  maxlength={255}
  // max length of osm tag is 255
  {...props}
/>
