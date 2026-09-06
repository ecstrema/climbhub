<script lang="ts">
  import * as Table from "@/ui/table";
  import EditableTextarea from "./editable-textarea.svelte";
  import { featureToTypeOSM, processedTags } from "$lib/osm-tags";
  import type { OsmFeature, Tags } from "osm-api";
  import { cn } from "$lib/utils";
  import { getOsmUser } from "@/shell/providers";

  const {
    feature,
  }: {
    feature: OsmFeature;
  } = $props();

  const tags = $derived.by(() => feature.tags || {});

  const osmUser = getOsmUser();

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
      <Table.Cell colspan={2}>{title}</Table.Cell>
    </Table.Row>
  {/if}
  {#each specialTags as key (key)}
    <Table.Row class={className}>
      <Table.Cell>{key}</Table.Cell>
      <Table.Cell>
        <EditableTextarea
          bind:value={() => tags[key], (v) => osmUser.setTag(feature, key, v ?? "")}
        />
      </Table.Cell>
    </Table.Row>
  {/each}
{/snippet}
