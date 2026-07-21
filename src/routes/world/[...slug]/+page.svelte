<script lang="ts">
    import * as Table from "@/ui/table";
    import type { PageProps } from "./$types";
    import { getName } from "$lib/data";
    import { getGrade } from "$lib/osm-tags";

    const { data }: PageProps = $props();

    const currentNode = $derived(data.elementData);

    const name: string | null = $derived(getName(currentNode));

    // Extract common climbing tags from OSM
    const grade = $derived(currentNode.type !== "geographic" ? getGrade(currentNode) : null);

    const coordinates = $derived.by(() => {

        if (currentNode.type === "node" && currentNode.lat) {
            return `${currentNode.lat}, ${currentNode.lon}`;
        }
        return "No coordinates available";
    });
</script>

<div class="prose">
    <h1>
        {name}
        {#if grade}
            <span class="text-xl text-muted-foreground ml-2">{grade}</span>
        {/if}
    </h1>

    <p class="text-sm text-muted-foreground">{coordinates}</p>

    <!-- Renders the OSM tags instead of the routes list, as children are in tree.json -->
    {#if currentNode.type !== "geographic" && currentNode.tags && Object.keys(currentNode.tags).length > 0}
        <h2>OpenStreetMap Data</h2>
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
