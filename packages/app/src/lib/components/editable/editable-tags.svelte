<script lang="ts">
  import * as Table from "@/ui/table";
  import EditableTextarea from "./editable-textarea.svelte";
  import { featureToTypeOSM, processedTags } from "$lib/osm-tags";
  import type { OsmFeature } from "osm-api";

  const {
    feature = $bindable(),
  }: {
    feature: OsmFeature;
  } = $props();

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

  <Table.Root>
    <Table.Header>
      <Table.Row>
        <Table.Head>Tag</Table.Head>
        <Table.Head>Value</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body class="font-medium">
      {#each unknownTags as key (key)}
        <Table.Row>
          <Table.Cell>{key}</Table.Cell>
          <Table.Cell><EditableTextarea bind:value={tags[key]} /></Table.Cell>
        </Table.Row>
      {/each}
      {#if invalidTags.length > 0}
        <Table.Row class="font-bold text-destructive">
          <Table.Cell colspan={2}>Invalid tags</Table.Cell>
        </Table.Row>
      {/if}
      {#each invalidTags as key (key)}
        <Table.Row class="text-destructive">
          <Table.Cell>{key}</Table.Cell>
          <Table.Cell><EditableTextarea bind:value={tags[key]} /></Table.Cell>
        </Table.Row>
      {/each}
      {#if knownTags.length > 0}
        <Table.Row class="font-bold text-muted-foreground">
          <Table.Cell colspan={2}>known tags</Table.Cell>
        </Table.Row>
      {/if}
      {#each knownTags as key (key)}
        <Table.Row class="text-muted-foreground">
          <Table.Cell>{key}</Table.Cell>
          <Table.Cell><EditableTextarea bind:value={tags[key]} /></Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
{/if}
