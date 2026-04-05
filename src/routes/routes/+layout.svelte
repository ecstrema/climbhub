<script lang="ts">
  import RouteTree from './RouteTree.svelte';
  const { data, children } = $props();
</script>

<nav>
  <RouteTree root={data.routeTree} />
</nav>

<main>
  {@render children()}
</main>

<footer>

</footer>
