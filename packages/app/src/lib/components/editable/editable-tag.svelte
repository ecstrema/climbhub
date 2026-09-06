<script lang="ts">
  import { getOsmUser } from "@/shell/providers";
  import EditableTextarea from "./editable-textarea.svelte";
  import type { OsmFeature, Tags } from "osm-api";
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
  const osmUser = getOsmUser();
</script>

<EditableTextarea
  bind:value={() => tags[tagKey], (v) => osmUser.setTag(feature, tagKey, v ?? "")}
  maxlength={255}
  // max length of osm tag is 255
  {...props}
/>
