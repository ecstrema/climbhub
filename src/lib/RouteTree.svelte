<script lang="ts">
  import { base } from "$app/paths"

  import type { TreeNode } from "./data"
  import { isAreaNode } from "./data"

  export let root: TreeNode
</script>

{#if isAreaNode(root)}
  <a href={base + root.link}>{root.name}</a>
  {#if root.children}
    <ul>
      {#each Object.values(root.children) as child}
        <li>
          <svelte:self root={child} />
        </li>
      {/each}
    </ul>
  {/if}
{:else}
  <a href={base + root.link}>{root.name} {root.grade}</a>
{/if}

<style>
  ul {
    list-style-type: none;
    padding-left: 6px;
  }
</style>
