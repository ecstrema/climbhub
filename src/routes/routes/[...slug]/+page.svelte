<script lang="ts">
    import { resolve } from "$app/paths";
    import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
    import * as Sidebar from "@/ui/sidebar";
    import * as Table from "@/ui/table";

    import type { PageProps } from "./$types";
    import { Separator } from "@/ui/separator";
    import type { RouteNode } from "$lib/types";
    import { getNodeSegments } from "$lib/data";

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

<header class="flex h-16 shrink-0 items-center gap-2 border-b px-4">
    <Sidebar.Trigger class="-ms-1" />
    <Separator
        orientation="vertical"
        class="me-2 data-[orientation=vertical]:h-4"
    />
    <Breadcrumb.Root>
        <Breadcrumb.List>
            {@const breadcrumbs = getNodeSegments(data.currentNode)}
            {@const lastElementIndex = breadcrumbs.length - 1}
            {#each breadcrumbs as breadcrumb, index}
                <Breadcrumb.Item>
                    {#if index === lastElementIndex}
                        <Breadcrumb.Page>{breadcrumb.name}</Breadcrumb.Page>
                    {:else}
                        <Breadcrumb.Link href={resolve(breadcrumb.link as any)}>
                            {breadcrumb.name}
                        </Breadcrumb.Link>
                    {/if}
                </Breadcrumb.Item>
                {#if index !== lastElementIndex}
                    <Breadcrumb.Separator />
                {/if}
            {/each}
        </Breadcrumb.List>
    </Breadcrumb.Root>
</header>

<div class="flex flex-1 flex-col gap-4 p-4">
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
</div>
