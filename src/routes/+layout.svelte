<script lang="ts">
  import { routeRoot } from "$lib/data"
  import RouteTree from "$lib/RouteTree.svelte"
</script>

<RouteTree root={routeRoot} />

<slot></slot>
