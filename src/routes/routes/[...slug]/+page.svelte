<script lang="ts">
    import type { PageData } from "./$types";

    type Props = {
        data: PageData;
    };
    const { data }: Props = $props();
</script>

{#if data.treeNode.kind === "area"}
    <h1>{data.treeNode.name}</h1>
{:else}
    <h1>{data.treeNode.name} {data.treeNode.grade}</h1>
{/if}

<p>{data.treeNode.coordinates}</p>
{@html data.content}
