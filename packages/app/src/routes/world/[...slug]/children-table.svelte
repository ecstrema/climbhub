<script lang="ts">
  import { resolve } from "$app/paths";
  import { getName } from "$lib/data";
  import { getCurrentNode } from "@/shell/providers";
  import * as Table from "@/ui/table";

  const currentNodeProvider = $derived(getCurrentNode().current);
  const children = $derived(Object.entries(currentNodeProvider.children || {}));
</script>

{#if children.length}
  <h2 class="text-lg font-semibold">Areas</h2>
  <Table.Root>
    <Table.Body>
      {#each children as [slug, child] (slug)}
        <Table.Row>
          <Table.Cell class="font-medium underline underline-offset-2">
            <a href={resolve("/world/[...slug]", { slug })}>{getName(child.own) || "No Name"}</a>
          </Table.Cell>
          <Table.Cell>{child.stats ? `${child.stats.totalRoutes} routes` : "No Stats"}</Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
{/if}
