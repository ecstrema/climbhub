<script lang="ts">
  import { resolve } from "$app/paths";
  import * as Collapsible from "@/ui/collapsible/index.js";
  import * as Sidebar from "@/ui/sidebar/index.js";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import type { BreadcrumbSegment, DataJSON, RecursiveData } from "$lib/types";

  import { getName, recursiveDataJSONFromRecord } from "$lib/data";
  import { Skeleton } from "@/ui/skeleton";
  import AppSidebarChildren from "./app-sidebar-children.svelte";
  import { getGrade } from "$lib/osm-tags";

  let {
    slug,
    item,
    breadcrumbs,
  }: {
    slug: string;
    item: RecursiveData<DataJSON>;
    breadcrumbs: BreadcrumbSegment[];
  } = $props();

  // Check if this specific node is part of the active path being viewed
  const isActivePath = $derived(breadcrumbs.some((b) => b.slug === slug));
  const isCurrentPage = $derived(breadcrumbs.at(-1)?.slug === slug);

  let open = $state(false);
  $effect(() => {
    if (isActivePath) {
      open = true;
    }
  });

  let children: typeof item.children | Promise<typeof item.children> =
    $derived.by(() => {
      return item.children;
    });

  const getChildren = async () => {
    if (await children) {
      return;
    }

    children = fetch(
      resolve("/api/world/[...slug]/children.json", { slug }),
    ).then(async (res) => {
      if (res.ok) {
        return recursiveDataJSONFromRecord(await res.json());
      }
    });
  };

  const link = $derived.by(() => {
    return resolve("/world/[...slug]", { slug });
  });
  const name = $derived(getName(item.own));
</script>

{#if item.own.type === "node"}
  {@const grade = getGrade(item.own)}
  <Sidebar.MenuButton
    isActive={isCurrentPage}
    class="data-[active=true]:bg-transparent"
  >
    <a href={link} class="truncate">
      <!-- TODO: Add grade/icon/color for difficulty -->
      {#if grade}
        <span class="text-sm text-amber-700 dark:text-amber-300">{grade}</span>
      {/if}
      <span>{name || "No name"}</span>
    </a>
  </Sidebar.MenuButton>
{:else}
  <Sidebar.MenuItem>
    <Collapsible.Root
      {open}
      onmouseenter={getChildren}
      class="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
    >
      <Collapsible.Trigger>
        {#snippet child({ props })}
          <Sidebar.MenuButton {...props}>
            <ChevronRightIcon class="transition-transform" />
            <a href={link} class="truncate">{name || "No name"}</a>
          </Sidebar.MenuButton>
        {/snippet}
      </Collapsible.Trigger>

      <Collapsible.Content>
        <Sidebar.MenuSub>
          {#await children}
            <Skeleton class="h-8 mt-2" />
          {:then children}
            {@const i: RecursiveData<DataJSON> = {own: item.own, children}}
            <AppSidebarChildren item={i} {breadcrumbs} />
          {/await}
        </Sidebar.MenuSub>
      </Collapsible.Content>
    </Collapsible.Root>
  </Sidebar.MenuItem>
{/if}
