<script lang="ts">
    import { resolve } from "$app/paths";
    import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";

    import type { PageProps } from "./$types";

    const { data }: PageProps = $props();

    const breadcrumbs = $derived.by(() => data.breadcrumbs);
</script>

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

<div class="prose">
    {#if data.treeNode.kind === "area"}
        <h1>{data.treeNode.name}</h1>
    {:else}
        <h1>{data.treeNode.name} {data.treeNode.grade}</h1>
    {/if}

    <p>{data.treeNode.coordinates}</p>
    {@html data.html}
</div>
