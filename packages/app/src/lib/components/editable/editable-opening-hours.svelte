<script lang="ts">
  import { getAppState } from "#lib/data/app-state.js";
  import { parseOpeningHours } from "#lib/data/parse/opening-hours.js";
  import type { OsmFeature } from "osm-api";
  import OpeningHours from "#components/opening-hours.svelte";
  import EditableTextarea from "./editable-textarea.svelte";
  import ClockIcon from "@lucide/svelte/icons/clock";

  const { feature, featureSlug }: { feature: OsmFeature; featureSlug: string } = $props();

  const appState = getAppState();
  const value = $derived(feature.tags?.opening_hours?.trim() ?? "");
  const unparsable = $derived(value !== "" && !parseOpeningHours(value));
</script>

{#if value || appState.osmUser.loggedIn}
  <div class="flex flex-col gap-1">
    <p class="flex items-center gap-2 text-sm">
      <ClockIcon class="size-4 text-muted-foreground" aria-hidden="true" />
      <span class="text-muted-foreground">Opening hours</span>
    </p>
    {#if value}
      <OpeningHours {value} />
    {/if}
    <EditableTextarea
      singleLine
      class="text-sm"
      placeholder="Mo-Fr 10:00-22:00; Sa-Su 10:00-18:00"
      bind:value={() => value, (v) => appState.setTag(featureSlug, "opening_hours", v.trim() || undefined)}
    />
    {#if unparsable}
      <p class="text-xs text-muted-foreground">This syntax is not shown in the graph.</p>
    {/if}
  </div>
{/if}
