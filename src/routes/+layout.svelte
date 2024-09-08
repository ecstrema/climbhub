<script lang="ts">
  import { routeRoot } from "$lib/data"
  import RouteTree from "$lib/RouteTree.svelte"

  console.log(routeRoot)
</script>

<RouteTree root={routeRoot} />

<slot></slot>
