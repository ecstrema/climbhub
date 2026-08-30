<script lang="ts">
  import { resolve } from "$app/paths";
  import { featureToType, getName } from "$lib/data";
  import { getGrade } from "$lib/osm-tags";
  import type { DataTree } from "$lib/types";
  import HolyGrade from "@/grade/holy-grade.svelte";
  import { sortChildren } from "@/shell/sidebar/sort-children";
  import * as Table from "@/ui/table";
  import type { OsmFeature } from "osm-api";
  import CircleQuestionMarkIcon from "@lucide/svelte/icons/circle-question-mark";
  import BuildingIcon from "@lucide/svelte/icons/building";

  const {
    item = $bindable(),
  }: {
    item: DataTree;
  } = $props();

  // TODO: reuse sorting done in sidebar? How bad is it for perf to sort again, like this? Maybe we can just pass the sorted list down from the parent component, but that would require a lot of refactoring.
  const childrenList = $derived.by(() => sortChildren(item));
</script>

{#if childrenList?.length && item.children}
  <h2 class="text-lg font-semibold">Areas</h2>
  <Table.Root>
    <Table.Body>
      {#each childrenList as slug (slug)}
        {@const child = item.children[slug]!}
        {@const childType = featureToType(child.feature)}
        <Table.Row>
          {#if childType === "geographic" || childType === "area"}
            <Table.Cell class="font-medium underline underline-offset-2">
              <a href={resolve("/world/[...slug]", { slug })}>
                {getName(child.feature) || "No Name"}
              </a>
            </Table.Cell>
            <Table.Cell>
              {#if child.stats && child.stats.totalRoutes > 0}
                {child.stats.totalRoutes} routes
              {:else}
                No routes
              {/if}
            </Table.Cell>
          {:else if childType === "gym"}
            <Table.Cell class="font-medium underline underline-offset-2 ">
              <a href={resolve("/world/[...slug]", { slug })} class="flex gap-1 items-center">
                <BuildingIcon class="size-5" />
                {getName(child.feature) || "No Name"}
              </a>
            </Table.Cell>
          {:else if childType === "route"}
            {const grade = getGrade((child.feature as OsmFeature).tags || {})}
            <Table.Cell>
              <a
                href={resolve("/world/[...slug]", { slug })}
                class="font-medium underline underline-offset-2"
              >
                {getName(child.feature) || "No Name"}
              </a>
            </Table.Cell>
            <Table.Cell>
              {#if grade}
                <HolyGrade class="text-xs font-semibold" grade={grade.v} />
              {:else}
                <CircleQuestionMarkIcon class="size-5 text-destructive" />
              {/if}
            </Table.Cell>
          {:else}
            <Table.Cell class="font-medium underline underline-offset-2">
              <a href={resolve("/world/[...slug]", { slug })}>
                {getName(child.feature) || "No Name"}
              </a>
            </Table.Cell>
          {/if}
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
{/if}
