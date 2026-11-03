<script lang="ts">
  import { getAppState } from "#lib/data/app-state.js";
  import { getLength } from "#lib/data/parse/osm-tags.js";
  import { cn } from "#lib/utils.js";
  import type { OsmFeature } from "osm-api";
  import EditableTextarea from "./editable-textarea.svelte";

  const {
    feature,
    featureSlug,
  }: {
    feature: OsmFeature;
    featureSlug: string;
  } = $props();

  const appState = getAppState();

  const length = $derived(feature.tags ? getLength(feature.tags) : undefined);
  const formatted = $derived(length === undefined ? "" : `${length}`);

  /** Text of the input. Follows the tag, except while typing so the text is not reformatted. */
  let draft = $state("");
  let focused = $state(false);
  $effect.pre(() => {
    if (!focused) draft = formatted;
  });

  let invalid = $state(false);

  /** Applies the length live. Accepts a number of metres, or an empty value to remove the length. */
  function setLength(input: string) {
    const value = input.trim().replace(",", ".");
    const match = value.match(/^(\d+(?:\.\d+)?)\s*m?$/);

    invalid = !!value && !match;
    if (invalid) return;

    appState.setTag(featureSlug, "climbing:length", match?.[1]);
  }
</script>

{#if length !== undefined || appState.osmUser.loggedIn}
  <span class="flex items-baseline gap-1 text-muted-foreground" title="Route length">
    <EditableTextarea
      singleLine
      class={cn("min-w-[3ch] text-right", invalid && "text-destructive")}
      bind:value={draft}
      placeholder="Length"
      oninput={() => setLength(draft)}
      onfocus={() => (focused = true)}
      onblur={() => {
        focused = false;
        invalid = false;
      }}
    />
    m
  </span>
{/if}
