<script lang="ts">
  import { osmUser } from "@/shell/providers";
  import EditableTextarea from "./editable-textarea.svelte";
  import type { OsmFeature } from "osm-api";
  import type { ComponentProps } from "svelte";

  const {
    tagKey,
    feature,
    ...props
  }: {
    tagKey: OsmApi.Keys["keys"];
    feature: OsmFeature;
  } & ComponentProps<typeof EditableTextarea> = $props();

  const tags = $derived(feature.tags ?? {});
</script>

<EditableTextarea
  bind:value={() => tags[tagKey], (v) => osmUser.setTag(feature, tagKey, v ?? "")}
  maxlength={255}
  // max length of osm tag is 255
  {...props}
/>
