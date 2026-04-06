<script lang="ts">
  import RouteTree from "./RouteTree.svelte";
  const { data, children } = $props();
</script>

<div class="flex flex-col min-h-screen p-4">
  <div class="flex gap-4 justify-center">
    <nav>
      <RouteTree root={data.routeTree} />
    </nav>

    <main class="grow">
      {@render children()}
    </main>

    <nav></nav>
  </div>

  <div class="grow"></div>
  <footer class="flex justify-center">Footer text</footer>
</div>
