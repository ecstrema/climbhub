<script lang="ts">
  import { resolve } from "$app/paths";

  import Self from "./RouteTree.svelte";

  const { root } = $props();
</script>

<nav>
  {#if root.kind  === "area"}
    <a href={resolve(root.link)}>{root.name}</a>
    {#if root.children}
      <ul>
        {#each Object.values(root.children) as child}
          <li>
            <Self root={child} />
          </li>
        {/each}
      </ul>
    {/if}
  {:else}
    <a href={resolve(root.link)}>{root.name} {root.grade}</a>
  {/if}
</nav>

<style>
  ul {
    list-style-type: none;
    padding-left: 6px;
  }
</style>
