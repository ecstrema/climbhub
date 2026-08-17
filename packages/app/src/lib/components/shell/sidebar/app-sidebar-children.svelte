<script lang="ts">
  import type { BreadcrumbSegment, DataTree } from "$lib/types";

  import AppSidebarNode from "./app-sidebar-node.svelte";

  let {
    item = $bindable(),
    breadcrumbs,
  }: {
    item: DataTree;
    breadcrumbs: BreadcrumbSegment[];
  } = $props();

  const orderedChildren: string[] | null = $derived.by(() => {
    if (!item.children) return null;

    if (item.own.type !== "relation") return Object.keys(item.children);

    const mapIdToItem: Record<string, string> = {};
    for (const [slug, data] of Object.entries(item.children)) {
      if (data.own.type === "geographic") {
        console.error("Geographic folder inside of relation");
        continue;
      }
      mapIdToItem[`${data.own.type}-${data.own.id}`] = slug;
    }

    const ordered: string[] = [];
    for (const member of item.own.members) {
      const item = mapIdToItem[`${member.type}-${member.ref}`];
      if (item) {
        ordered.push(item);
      }
    }
    return ordered;
  });
</script>

{#each orderedChildren as slug (slug)}
  <AppSidebarNode bind:item={item.children![slug]} {breadcrumbs} {slug} />
{:else}
  No children
{/each}
