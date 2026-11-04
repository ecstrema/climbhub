<script lang="ts">
  import { getAppState } from "#lib/data/app-state.js";
  import { parseClimbingLength } from "#lib/data/parse/osm-tags.js";
  import { cn } from "#lib/utils.js";
  import type { OsmFeature } from "osm-api";
  import EditableTextarea from "./editable-textarea.svelte";
  import { Button } from "#components/ui/button/index.js";
  import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";

  const {
    feature,
    featureSlug,
  }: {
    feature: OsmFeature;
    featureSlug: string;
  } = $props();

  const appState = getAppState();

  const rawLength = $derived(feature.tags?.["climbing:length"]);
  const parsedLength = $derived(parseClimbingLength(rawLength));
  const length = $derived(parsedLength?.meters);
  const formatted = $derived(length === undefined ? "" : `${length}`);

  let draft = $state("");
  let focused = $state(false);
  const inputValue = $derived(focused ? draft : formatted);

  let invalid = $state(false);

  /** Applies the length live. Accepts a number of metres, or an empty value to remove the length. */
  function setLength(input: string) {
    const value = input.trim().replace(",", ".");
    const match = value.match(/^(\d+(?:\.\d+)?)\s*m?$/);

    invalid = !!value && !match;
    if (invalid) return;

    appState.setTag(featureSlug, "climbing:length", match?.[1]);
  }

  function rewriteFeetAsMeters() {
    if (parsedLength?.sourceUnit !== "feet") return;
    const meters = Math.round(parsedLength.meters * 100) / 100;
    appState.setTag(featureSlug, "climbing:length", `${meters}`);
  }
</script>

{#if length !== undefined || appState.osmUser.loggedIn}
  <div class="flex flex-col items-start gap-1">
    <span class="flex items-baseline gap-1 text-muted-foreground" title="Route length">
      <EditableTextarea
        singleLine
        class={cn("min-w-[3ch] text-right", invalid && "text-destructive")}
        value={inputValue}
        placeholder="Length"
        oninput={(event) => {
          draft = event.currentTarget.value;
          setLength(draft);
        }}
        onfocus={() => {
          draft = formatted;
          focused = true;
        }}
        onblur={() => {
          focused = false;
          invalid = false;
        }}
      />
      m
      {#if length !== undefined && length > 30}
        <TriangleAlertIcon
          class="size-3 text-amber-600"
          aria-label="Route length exceeds 30 meters"
          title="Route length exceeds 30 meters"
        />
      {/if}
    </span>
    {#if parsedLength?.sourceUnit === "feet"}
      <div class="flex flex-wrap items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400" role="note">
        <TriangleAlertIcon class="size-3 shrink-0" aria-hidden="true" />
        <span>Feet are not an officially supported length unit.</span>
        <Button
          size="xs"
          variant="outline"
          disabled={!appState.osmUser.loggedIn}
          title={appState.osmUser.loggedIn ? "Rewrite the OSM length in meters" : "Log in to edit OSM tags"}
          onclick={rewriteFeetAsMeters}>Rewrite as meters</Button
        >
      </div>
    {/if}
  </div>
{/if}
