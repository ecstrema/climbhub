<script lang="ts">
    import type { PageData } from "./$types";
    import { isAreaNode } from "$lib/data";
    export let data: PageData;
</script>

{#if isAreaNode(data)}
    <h1>{data.name}</h1>
    <p>{data.coordinates}</p>
    {@html data.description}
{:else}
    <h1>{data.name} {data.grade}</h1>
    <p>{data.coordinates}</p>
    {@html data.description}
{/if}
