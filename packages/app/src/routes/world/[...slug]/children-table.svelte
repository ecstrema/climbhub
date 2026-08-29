<script lang="ts">
  import { resolve } from "$app/paths";
  import { getName } from "$lib/data";
  import type { DataTree } from "$lib/types";
  import * as Table from "@/ui/table";

  const {
    children = $bindable(),
  }: {
    children: Record<string, DataTree> | undefined;
  } = $props();

  const childrenList = $derived(Object.entries(children || {}));
</script>

{#if childrenList.length}
  <h2 class="text-lg font-semibold">Areas</h2>
  <Table.Root>
    <Table.Body>
      {#each childrenList as [slug, child] (slug)}
        <Table.Row>
          <Table.Cell class="font-medium underline underline-offset-2">
            <a href={resolve("/world/[...slug]", { slug })}>
              {getName(child.feature) || "No Name"}
            </a>
          </Table.Cell>
          <Table.Cell>{child.stats ? `${child.stats.totalRoutes} routes` : "No Stats"}</Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
{/if}
