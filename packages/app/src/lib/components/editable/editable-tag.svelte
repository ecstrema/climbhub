<script lang="ts">
  import EditableTextarea from "./editable-textarea.svelte";
  import type { Tags } from "osm-api";
  import type { ComponentProps } from "svelte";

  const {
    source,
    tags = $bindable(),
    ...props
  }: {
    source: OsmApi.Keys["keys"];
    tags: Tags;
  } & ComponentProps<typeof EditableTextarea> = $props();
</script>

<EditableTextarea bind:value={tags[source]} maxlength={255} {...props} />
