<script lang="ts">
  import type { BreadcrumbSegment, DataJSON, RecursiveData } from "$lib/types";

  import AppSidebarNode from "./app-sidebar-node.svelte";

  let {
    item,
    breadcrumbs,
  }: {
    item: RecursiveData<DataJSON>;
    breadcrumbs: BreadcrumbSegment[];
  } = $props();

  const orderedChildren: [string, RecursiveData<DataJSON>][] | null = $derived.by(() => {
    if (!item.children) return null;

    if (item.own.type !== "relation") return Object.entries(item.children);

    const mapIdToItem: Record<string, [string, RecursiveData<DataJSON>]> = {};
    for (const [slug, data] of Object.entries(item.children)) {
      if (data.own.type === "geographic") {
        console.error("Geographic folder inside of relation");
        continue;
      }
      mapIdToItem[`${data.own.type}-${data.own.id}`] = [slug, data];
    }

    const ordered: [string, RecursiveData<DataJSON>][] = [];
    for (const member of item.own.members) {
      const item = mapIdToItem[`${member.type}-${member.ref}`];
      if (item) {
        ordered.push(item);
      }
    }
    return ordered;
  });
</script>

{#each orderedChildren as [slug, child] (slug)}
  <AppSidebarNode item={child} {breadcrumbs} {slug} />
{:else}
  No children
{/each}
