<script lang="ts">
  import RouteTree from './RouteTree.svelte';
  const { data, children } = $props();
</script>

<RouteTree root={data.routeTree} />

<main>
  {@render children()}
</main>
