<script lang="ts">
  import { resolve } from "$app/paths";
  import * as Collapsible from "@/ui/collapsible/index.js";
  import * as Sidebar from "@/ui/sidebar/index.js";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import type { AreaStats, BreadcrumbSegment, DataJSONRecord, DataTree } from "$lib/types";

  import { getName, dataTreeFromJsonRecord } from "$lib/data";
  import { Skeleton } from "@/ui/skeleton";
  import AppSidebarChildren from "./app-sidebar-children.svelte";
  import HolyGrade from "@/grade/holy-grade.svelte";
  import { onMount } from "svelte";

  let {
    slug,
    item = $bindable(),
    breadcrumbs,
  }: {
    slug: string;
    item: DataTree;
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

  let childrenPending = $state(false);

  const getChildren = async () => {
    if (item.children || childrenPending) return;

    childrenPending = true;

    const res = await fetch(resolve("/api/world/[...slug]/children.json", { slug }));

    if (!res.ok) {
      console.log("Failed to fetch children for slug", slug);
      return;
    }
    item.children = dataTreeFromJsonRecord((await res.json()) as DataJSONRecord);
    childrenPending = false;
  };

  let statsPending = $state(false);

  const getStats = async () => {
    if (item.stats || statsPending || item.feature.type === "node") return;
    statsPending = true;

    const res = await fetch(resolve("/api/world/[...slug]/stats.json", { slug }));

    if (!res.ok) {
      console.log("Failed to fetch stats for slug", slug);
      return;
    }

    item.stats = (await res.json()) as AreaStats;

    statsPending = false;
  };

  onMount(getStats);

  const link = $derived.by(() => {
    return resolve("/world/[...slug]", { slug });
  });
  const name = $derived(getName(item.feature));
</script>

{#if item.feature.type === "node"}
  <Sidebar.MenuButton isActive={isCurrentPage} class="data-[active=true]:bg-accent">
    <a href={link} class="truncate w-full">
      <HolyGrade class="text-xs font-semibold" tags={item.feature.tags} />
      <span>{name || "No name"}</span>
    </a>
  </Sidebar.MenuButton>
{:else}
  <Sidebar.MenuItem>
    <Collapsible.Root
      {open}
      onmouseenter={getChildren}
      class="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90 w-full"
    >
      <Collapsible.Trigger>
        {#snippet child({ props })}
          <Sidebar.MenuButton {...props}>
            <ChevronRightIcon class="transition-transform" />
            <a href={link} class="truncate grow">{name || "No name"}</a>
            {#if item.stats}
              <span class="text-muted-foreground">{item.stats.totalRoutes}</span>
            {/if}
          </Sidebar.MenuButton>
        {/snippet}
      </Collapsible.Trigger>

      <Collapsible.Content>
        <Sidebar.MenuSub>
          {#if childrenPending}
            <Skeleton class="h-8 mt-2" />
          {:else}
            <AppSidebarChildren bind:item {breadcrumbs} />
          {/if}
        </Sidebar.MenuSub>
      </Collapsible.Content>
    </Collapsible.Root>
  </Sidebar.MenuItem>
{/if}
