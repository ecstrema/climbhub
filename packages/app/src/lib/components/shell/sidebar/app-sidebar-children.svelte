<script lang="ts">
  import { featureToType, getName } from "$lib/data";
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

    if (item.feature.type !== "relation")
      return Object.entries(item.children)
        .sort(([_ka, va], [_kb, vb]) => {
          const typeA = featureToType(va.feature);
          const typeB = featureToType(vb.feature);
          function typeOrder(type: string | undefined) {
            switch (type) {
              case "area":
                return 0;
              case "route":
                return 1;
              case "gym":
                return 2;
              default:
                return 3;
            }
          }
          const orderA = typeOrder(typeA);
          const orderB = typeOrder(typeB);
          if (orderA !== orderB) {
            return orderA - orderB;
          }

          const nameA = getName(va.feature);
          const nameB = getName(vb.feature);
          if (nameA && nameB) {
            return nameA.localeCompare(nameB);
          }
          return 0;
        })
        .map(([slug]) => slug);

    // If this is a relation, we want to order the children according to the order of the members in the relation
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
    Failed to get children
  {/if}
{:else}
  No children
{/each}
