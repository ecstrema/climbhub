<script lang="ts">
  import * as Table from "@/ui/table";
  import EditableTextarea from "./editable-textarea.svelte";
  import { featureToTypeOSM, processedTags } from "$lib/data/parse/osm-tags";
  import type { OsmFeature, Tags } from "osm-api";
  import { cn } from "$lib/utils";
  import { getAppState } from "$lib/data/app-state";
  import { Button } from "@/ui/button";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";

  const {
    feature,
    featureSlug,
  }: {
    feature: OsmFeature;
    featureSlug: string;
  } = $props();

  const appState = getAppState();

  const tags = $derived.by(() => feature.tags || {});

  const { knownTags, invalidTags, unknownTags } = $derived.by(() => {
    const knownTags: OsmApi.Keys["keys"][] = [];
    const unknownTags: OsmApi.Keys["keys"][] = [];
    const invalidTags: OsmApi.Keys["keys"][] = [];

    const featureType = featureToTypeOSM(feature);
    if (!featureType) {
      return { knownTags, invalidTags, unknownTags: Object.keys(tags) as OsmApi.Keys["keys"][] };
    }

    const processedTagsForElement = processedTags[featureType];

    for (let k of Object.keys(tags)) {
      const key = k as OsmApi.Keys["keys"];

      const validator = processedTagsForElement[key];
      if (!validator) {
        unknownTags.push(key);
        continue;
      }
      if (validator(tags[key]!)) {
        knownTags.push(key);
      } else {
        invalidTags.push(key);
      }
    }
    return { knownTags, invalidTags, unknownTags };
  });
</script>

{#if knownTags.length > 0 || invalidTags.length > 0 || unknownTags.length > 0}
  <h2 class="text-lg font-semibold">OpenStreetMap Data</h2>

  <Table.Root class="max-w-96">
    <Table.Header>
      <Table.Row>
        <Table.Head>Tag</Table.Head>
        <Table.Head>Value</Table.Head>
        <Table.Head></Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body class="font-medium">
      {@render showTags(unknownTags, "Unknown tags", "")}
      {@render showTags(invalidTags, "Invalid tags", "text-destructive")}
      {@render showTags(knownTags, "Known tags", "text-muted-foreground")}
    </Table.Body>
  </Table.Root>
{/if}

{#snippet showTags(specialTags: OsmApi.Keys["keys"][], title: string, className: string)}
  {#if specialTags.length > 0}
    <Table.Row
      class={cn(
        "font-bold text-center border-b-3 [border-bottom-style:double] border-b-muted-foreground h-12",
        className,
      )}
    >
      <Table.Cell colspan={3}>{title}</Table.Cell>
    </Table.Row>
  {/if}
  {#each specialTags as key (key)}
    <Table.Row class={className}>
      <Table.Cell>{key}</Table.Cell>
      <Table.Cell>
        <EditableTextarea bind:value={() => tags[key], (v) => appState.setTag(featureSlug, key, v)} />
      </Table.Cell>
      <Table.Cell>
        <Button
          size="icon-sm"
          variant="ghost"
          title="Delete tag {key}"
          onclick={() => appState.deleteTag(featureSlug, key)}
        >
          <Trash2Icon />
        </Button>
      </Table.Cell>
    </Table.Row>
  {/each}
{/snippet}
