<script lang="ts">
    import { resolve } from "$app/paths";
    import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
    import * as Sidebar from "@/ui/sidebar";

    import type { PageProps } from "./$types";
    import { Separator } from "@/ui/separator";

    const { data }: PageProps = $props();

    const breadcrumbs = $derived.by(() => data.breadcrumbs);
</script>

<header class="flex h-16 shrink-0 items-center gap-2 border-b px-4">
    <Sidebar.Trigger class="-ms-1" />
    <Separator
        orientation="vertical"
        class="me-2 data-[orientation=vertical]:h-4"
    />
    <Breadcrumb.Root>
        <Breadcrumb.List>
            {#each breadcrumbs as breadcrumb, index}
                <Breadcrumb.Item>
                    {#if index === breadcrumbs.length - 1}
                        <Breadcrumb.Page>{breadcrumb.name}</Breadcrumb.Page>
                    {:else}
                        <Breadcrumb.Link href={resolve(breadcrumb.link as any)}>
                            {breadcrumb.name}
                        </Breadcrumb.Link>
                    {/if}
                </Breadcrumb.Item>
                {#if index !== breadcrumbs.length - 1}
                    <Breadcrumb.Separator />
                {/if}
            {/each}
        </Breadcrumb.List>
    </Breadcrumb.Root>
</header>

<div class="flex flex-1 flex-col gap-4 p-4">
    <div class="prose">
        {#if data.treeNode.kind === "area"}
            <h1>{data.treeNode.name}</h1>
        {:else}
            <h1>{data.treeNode.name} {data.treeNode.grade}</h1>
        {/if}

        <p>{data.treeNode.coordinates}</p>
        {@html data.html}
    </div>
</div>
