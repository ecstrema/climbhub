<script lang="ts">
  import * as Table from "@/ui/table";
  import { getName } from "$lib/data";
  import { getCoordinates, getDescription, getGrade } from "$lib/osm-tags";

  import type { PageProps } from "./$types";
  import type { DataJSON } from "climbing-data-gen";
  import { getCurrentNode } from "@/shell/providers";
  import HolyGrade from "@/grade/holy-grade.svelte";

  const { data }: PageProps = $props();

  const currentNodeProvider = getCurrentNode();
  const currentNode: DataJSON = $derived(currentNodeProvider.current);

  const name: string | null = $derived(getName(currentNode));

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
    return getDescription(currentNode.tags ?? {});
  });
</script>

<head>
  <title>Climbhub {name ? ` - ${name}` : ""}</title>
</head>

<div>
  <h1>
    <span class="text-2xl font-bold">{name}</span>
    {#if currentNode.type !== "geographic" && currentNode.tags}
      <HolyGrade class="font-semibold text-sm" tags={currentNode.tags} />
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
