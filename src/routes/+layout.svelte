<script lang="ts">
  import { getRouteRoot } from "$lib/data"
  import RouteTree from "$lib/RouteTree.svelte"

  const routeRoot = getRouteRoot()
</script>

{#await routeRoot}
  <p>Loading...</p>
{:then tree}
  <RouteTree root={tree} />
{/await}

<slot></slot>
