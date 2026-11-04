<script lang="ts">
  import { resolve } from "$app/paths";
  import { featureToType } from "#lib/data/parse/data.js";
  import { getLocalizedName } from "#lib/data/parse/localized-name.js";
  import { getGrade } from "#lib/data/parse/osm-tags.js";
  import type { DataTree } from "#lib/types.js";
  import HolyGrade from "#components/grade/holy-grade.svelte";
  import { sortChildren, type SortedChildren } from "#components/shell/sidebar/utils.ts";
  import * as Table from "#components/ui/table/index.js";
  import type { OsmFeature } from "osm-api";
  import CircleQuestionMarkIcon from "@lucide/svelte/icons/circle-question-mark";
  import BuildingIcon from "@lucide/svelte/icons/building";

  const {
    item = $bindable(),
  }: {
    item: DataTree;
  } = $props();

  // TODO: reuse sorting done in sidebar? How bad is it for perf to sort again, like this? Maybe we can just pass the sorted list down from the parent component, but that would require a lot of refactoring.
  const allChildren: SortedChildren | undefined = $derived.by(() => sortChildren(item));

  const itemChildren = $derived.by(() => item.children ?? {});
</script>

<h2 class="text-lg font-semibold">Areas</h2>
<Table.Root>
  <Table.Body>
    {#if allChildren}
      {#each [...allChildren?.geographic, ...allChildren?.area] as slug (slug)}
        {const child = $derived(itemChildren[slug]!)}
        <Table.Row>
          <Table.Cell class="font-medium underline underline-offset-2">
            <a href={resolve("/world/[...slug]", { slug })}>
              {getLocalizedName(child.feature) || "No Name"}
            </a>
          </Table.Cell>
          <Table.Cell>
            {#if child.stats && child.stats.totalRoutes > 0}
              {child.stats.totalRoutes} routes
            {:else}
              No routes
            {/if}
          </Table.Cell>
        </Table.Row>
      {/each}
      {#each allChildren?.gym as slug (slug)}
        {const child = $derived(itemChildren[slug]!)}
        <Table.Row>
          <Table.Cell class="font-medium underline underline-offset-2 ">
            <a href={resolve("/world/[...slug]", { slug })} class="flex gap-1 items-center">
              <BuildingIcon class="size-5" />
              {getLocalizedName(child.feature) || "No Name"}
            </a>
          </Table.Cell>
        </Table.Row>
      {/each}
      {#each allChildren?.route as slug (slug)}
        {const child = $derived(itemChildren[slug]!)}
        {const grade = $derived(getGrade((child.feature as OsmFeature).tags || {}))}
        <Table.Row>
          <Table.Cell>
            <a href={resolve("/world/[...slug]", { slug })} class="font-medium underline underline-offset-2">
              {getLocalizedName(child.feature) || "No Name"}
            </a>
          </Table.Cell>
          <Table.Cell>
            {#if grade}
              <HolyGrade class="text-xs font-semibold" grade={grade.v} />
            {:else}
              <CircleQuestionMarkIcon class="size-5 text-destructive" />
            {/if}
          </Table.Cell>
        </Table.Row>
      {/each}
      {#each allChildren.other as slug (slug)}
        {const child = $derived(itemChildren[slug]!)}
        <Table.Row>
          <Table.Cell class="font-medium underline underline-offset-2">
            <a href={resolve("/world/[...slug]", { slug })}>
              {getLocalizedName(child.feature) || "No Name"}
            </a>
          </Table.Cell>
        </Table.Row>
      {/each}
    {:else}
      <Table.Row>
        <Table.Cell colspan={2}>No children</Table.Cell>
      </Table.Row>
    {/if}
  </Table.Body>
</Table.Root>
