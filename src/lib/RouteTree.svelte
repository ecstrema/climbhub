<script lang="ts">
  import type { TreeNode } from "./data"
  import { isAreaNode } from "./data"

  export let root: TreeNode
</script>

{#if isAreaNode(root)}
  <a href={root.link}>{root.name}</a>
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
  <a href={root.link}>{root.name} {root.grade}</a>
{/if}

<style>
  ul {
    list-style-type: none;
    padding-left: 6px;
  }
</style>
