<script lang="ts">
    import * as Table from "@/ui/table";

    import type { PageProps } from "./$types";
    import type { RouteNode } from "$lib/types";

    const { data }: PageProps = $props();

    const routesInArea = $derived.by(() => {
        if (data.currentNode.type === "area" && data.currentNode.children) {
            return Object.values(data.currentNode.children).filter(
                (child): child is RouteNode => child.type === "route",
            );
        }
        return [];
    });
</script>

<div class="prose">
    {#if data.currentNode.type === "area"}
        <h1>{data.currentNode.name}</h1>
    {:else}
        <h1>{data.currentNode.name} {data.currentNode.grade}</h1>
    {/if}

    <p>{data.currentNode.coordinates}</p>
    {@html data.currentNode.html}

    {#if data.currentNode.type === "area" && routesInArea.length > 0}
        <h2>Routes</h2>
        <Table.Root>
            <Table.Header>
                <Table.Row>
                    <Table.Head>Name</Table.Head>
                    <Table.Head>Grade</Table.Head>
                    <Table.Head>Rating</Table.Head>
                    <Table.Head>Kind</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {#each routesInArea as route}
                    <Table.Row>
                        <Table.Cell class="font-medium">
                            <a href={route.link}>{route.name}</a>
                        </Table.Cell>
                        <Table.Cell>{route.grade}</Table.Cell>
                        <Table.Cell>
                            {#if route.rating}
                                {route.rating}
                            {:else}
                                <span class="text-muted-foreground">
                                    No rating
                                </span>
                            {/if}
                        </Table.Cell>
                        <Table.Cell>{route.kind || "Sport"}</Table.Cell>
                    </Table.Row>
                {/each}
            </Table.Body>
        </Table.Root>
    {/if}
</div>
