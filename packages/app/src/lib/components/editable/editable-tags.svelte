<script lang="ts">
  import { getCurrentNode } from "@/shell/providers";
  import * as Table from "@/ui/table";
  import * as Collapsible from "@/ui/collapsible";
  import EditableText from "./editable-text.svelte";
  import { processedTags } from "$lib/osm-tags";

  const currentNode = $derived(getCurrentNode().current.own);

  const [knownTags, unknownTags] = $derived.by(() => {
    if (currentNode.type === "geographic" || !currentNode.tags) {
      return [[], []];
    }
    const processedTagsForElement = processedTags[currentNode.type as "node" | "way" | "relation"];
    const knownTags: OsmApi.Keys[] = [];
    const unknownTags: OsmApi.Keys[] = [];
    for (const key in currentNode.tags) {
      if (processedTagsForElement[key]?.(currentNode.tags[key]!)) {
        unknownTags.push(key);
      } else {
        knownTags.push(key);
      }
    }
    return [knownTags, unknownTags];
  });
</script>

{#if currentNode.type !== "geographic" && currentNode.tags && (knownTags.length > 0 || unknownTags.length > 0)}
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
          <Table.Cell><EditableText bind:value={currentNode.tags[key as string]} /></Table.Cell>
        </Table.Row>
      {/each}
      {#each unknownTags as key (key)}
        <Table.Row class="font-medium text-muted-foreground">
          <Table.Cell>{key}</Table.Cell>
          <Table.Cell><EditableText bind:value={currentNode.tags[key as string]} /></Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
{/if}
