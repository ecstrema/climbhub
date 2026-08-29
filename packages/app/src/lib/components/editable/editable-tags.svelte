<script lang="ts">
  import * as Table from "@/ui/table";
  import EditableTextarea from "./editable-textarea.svelte";
  import { processedTags } from "$lib/osm-tags";
  import type { OsmFeature, Tags } from "osm-api";

  const {
    feature = $bindable(),
  }: {
    feature: OsmFeature;
  } = $props();

  const tags = $derived.by(() => feature.tags || {});

  const [knownTags, unknownTags] = $derived.by(() => {
    const processedTagsForElement = processedTags[feature.type];
    const knownTags: OsmApi.Keys["keys"][] = [];
    const unknownTags: OsmApi.Keys["keys"][] = [];

    for (let k of Object.keys(tags)) {
      const key = k as OsmApi.Keys["keys"];

      const validator = processedTagsForElement[key];
      if (validator?.(tags[key]!)) {
        knownTags.push(key);
      } else {
        unknownTags.push(key);
      }
    }
    return [knownTags, unknownTags];
  });
</script>

{#if knownTags.length > 0 || unknownTags.length > 0}
  <h2 class="text-lg font-semibold">OpenStreetMap Data</h2>

  <Table.Root>
    <Table.Header>
      <Table.Row>
        <Table.Head>Tag</Table.Head>
        <Table.Head>Value</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each knownTags as key (key)}
        <Table.Row>
          <Table.Cell class="font-medium">{key}</Table.Cell>
          <Table.Cell><EditableTextarea bind:value={tags[key]} /></Table.Cell>
        </Table.Row>
      {/each}
      {#each unknownTags as key (key)}
        <Table.Row class="font-medium text-muted-foreground">
          <Table.Cell>{key}</Table.Cell>
          <Table.Cell><EditableTextarea bind:value={tags[key]} /></Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
{/if}
