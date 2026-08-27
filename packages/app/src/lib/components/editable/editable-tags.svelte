<script lang="ts">
  import { getCurrentNode } from "@/shell/providers";
  import * as Table from "@/ui/table";
  import * as Collapsible from "@/ui/collapsible";
  import EditableText from "./editable-text.svelte";
  import { processedTags } from "$lib/osm-tags";

  const currentNode = $derived(getCurrentNode().current.own);

  const tagsArray = $derived.by(() => {
    if (currentNode.type === "geographic" || !currentNode.tags) {
      return [];
    }
    const processedTagsForElement = processedTags[currentNode.type];
    return Object.keys(currentNode.tags).filter((key) => {
      return !processedTagsForElement[key]?.(currentNode.tags![key]);
    });
  });
</script>

{#if currentNode.type !== "geographic" && currentNode.tags && tagsArray.length > 0}
  <h2 class="text-lg font-semibold">OpenStreetMap Data</h2>
  <Table.Root>
    <Table.Header>
      <Table.Row>
        <Table.Head>Tag</Table.Head>
        <Table.Head>Value</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each tagsArray as key (key)}
        <Table.Row>
          <Table.Cell class="font-medium">{key}</Table.Cell>
          <Table.Cell><EditableText bind:value={currentNode.tags[key]} /></Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
{/if}
