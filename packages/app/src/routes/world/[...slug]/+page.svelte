<script lang="ts">
  import * as Table from "@/ui/table";
  import { getName } from "$lib/data";
  import { getCoordinates, getDescription } from "$lib/osm-tags";

  import { getCurrentNode } from "@/shell/providers";
  import HolyGrade from "@/grade/holy-grade.svelte";
  import { resolve } from "$app/paths";

  const currentNodeProvider = getCurrentNode();
  const currentNode = $derived(currentNodeProvider.current.own);

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

  const children = $derived(Object.entries(currentNodeProvider.current.children ?? {}));
</script>

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

  {#if currentNodeProvider.current.stats?.totalRoutes}
    <p>{currentNodeProvider.current.stats?.totalRoutes}</p>
  {/if}

  {#if children.length}
    <h2 class="text-lg font-semibold">Areas</h2>
    <Table.Root>
      <Table.Body>
        {#each children as [slug, child] (slug)}
          <Table.Row>
            <Table.Cell class="font-medium underline underline-offset-2">
              <a href={resolve("/world/[...slug]", { slug })}>{getName(child.own) || "No Name"}</a>
            </Table.Cell>
            <Table.Cell>stats</Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
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
