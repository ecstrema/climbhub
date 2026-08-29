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

  const orderedChildren: string[] | undefined = $derived.by(() => {
    if (!item.children) return;

    if (item.feature.type !== "relation") return Object.keys(item.children);

    const mapIdToItem: Record<string, string> = {};
    for (const [slug, data] of Object.entries(item.children)) {
      if (data.feature.type === "geographic") {
        console.error("Geographic folder inside of relation");
        continue;
      }
      mapIdToItem[`${data.feature.type}-${data.feature.id}`] = slug;
    }

    const ordered: string[] = [];
    for (const member of item.feature.members) {
      const i = mapIdToItem[`${member.type}-${member.ref}`];
      if (i) {
        ordered.push(i);
      }
    }
    return ordered;
  });
</script>

{#each orderedChildren as slug (slug)}
  {#if item.children?.[slug]}
    <AppSidebarNode bind:item={item.children[slug]} {breadcrumbs} {slug} />
  {:else}
    Could not get child
  {/if}
{:else}
  No children
{/each}
