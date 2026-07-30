<script lang="ts">
  import * as Table from "@/ui/table";
  import type { PageProps } from "./$types";
  import { getName } from "$lib/data";
  import { getCoordinates, getDescription, getGrade } from "$lib/osm-tags";

  import { rootElement } from "./root";

  const { data, params }: PageProps = $props();

  const currentNode = $derived(params.slug ? data.data[params.slug] : rootElement);

  const name: string | null = $derived(getName(currentNode));

  // Extract common climbing tags from OSM
  const grade = $derived(currentNode.type !== "geographic" ? getGrade(currentNode) : null);

  const coordinates = $derived.by(() => {
    if (currentNode.type === "geographic") {
      return null;
    }

    return getCoordinates(currentNode);
  });

  const description: string | null = $derived.by(() => {
    if (currentNode.type === "geographic") {
      return null;
    }
    return getDescription(currentNode);
  });
</script>

<div>
  <h1>
    <span class="text-2xl font-bold">{name}</span>
    {#if grade}
      <span class="text-xl text-muted-foreground ml-2">{grade}</span>
    {/if}
  </h1>

  {#if coordinates}
    <p class="text-sm text-muted-foreground">{coordinates.lat}, {coordinates.lon}</p>
  {/if}

  {#if description}
    <p>{description}</p>
  {/if}

  {#if data.stats}
    <p>{data.stats.totalRoutes}</p>
  {/if}

  <!-- Renders the OSM tags instead of the routes list, as children are in tree.json -->
  {#if currentNode.type !== "geographic" && currentNode.tags && Object.keys(currentNode.tags).length > 0}
    <h2 class="text-lg font-semibold">OpenStreetMap Data</h2>
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>Tag</Table.Head>
          <Table.Head>Value</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each Object.entries(currentNode.tags) as [key, val]}
          <Table.Row>
            <Table.Cell class="font-medium">{key}</Table.Cell>
            <Table.Cell>{val}</Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  {/if}
</div>
