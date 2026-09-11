<script lang="ts">
  import { resolve } from "$app/paths";
  import * as Collapsible from "@/ui/collapsible/index.js";
  import * as Sidebar from "@/ui/sidebar/index.js";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import EarthIcon from "@lucide/svelte/icons/earth";
  import CircleQuestionMarkIcon from "@lucide/svelte/icons/circle-question-mark";
  import BuildingIcon from "@lucide/svelte/icons/building";
  import type { DataTree } from "$lib/types";

  import { getName, featureToType } from "$lib/data";
  import { Skeleton } from "@/ui/skeleton";
  import AppSidebarChildren from "./app-sidebar-children.svelte";
  import HolyGrade from "@/grade/holy-grade.svelte";
  import { onMount } from "svelte";
  import { getGrade } from "$lib/osm-tags";
  import type { OsmFeature } from "osm-api";
  import { getBreadcrumbs, getTree } from "../providers";
  import { page } from "$app/state";

  let {
    slug,
    item = $bindable(),
  }: {
    slug: string;
    item: DataTree;
  } = $props();

  const breadcrumbSlugs = $derived(getBreadcrumbs().slugs);
  const tree = getTree();

  const isCurrentPage = $derived((page.params.slug ?? "") === slug);
  // Check if this specific node is part of the active path being viewed
  const isActivePath = $derived(isCurrentPage || breadcrumbSlugs.some((s) => s === slug));

  let open = $state(false);
  $effect(() => {
    if (isActivePath || isCurrentPage) open = true;
  });

  $effect(() => {
    if (open) tree.fetchChildren(slug);
  });

  onMount(() => tree.fetchStats(slug));

  const link = $derived.by(() => {
    return resolve("/world/[...slug]", { slug });
  });
  const name = $derived(getName(item.feature));

  const itemType = $derived(featureToType(item.feature));

  let ref = $state<HTMLElement | null>(null);

  $effect(() => {
    if (isCurrentPage && ref) {
      ref.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }
  });
</script>

{#if itemType === "route" || itemType === "gym"}
  <Sidebar.MenuButton
    bind:ref={ref as HTMLButtonElement}
    isActive={isCurrentPage}
    href={link}
    class="data-[active=true]:bg-accent truncate w-full"
  >
    {#if itemType === "route"}
      {@const grade = getGrade((item.feature as OsmFeature).tags || {})}
      {#if grade}
        <HolyGrade class="text-xs font-semibold" grade={grade.v} />
      {:else}
        <CircleQuestionMarkIcon class="text-destructive" />
      {/if}
    {:else if itemType === "gym"}
      <BuildingIcon />
    {/if}
    <span>{name || "No name"}</span>
  </Sidebar.MenuButton>
{:else}
  <Collapsible.Root
    {open}
    onmouseenter={() => tree.fetchChildren(slug)}
    class="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90 w-full"
  >
    <Collapsible.Trigger>
      {#snippet child({ props })}
        <Sidebar.MenuItem bind:ref={ref as HTMLLIElement} {...props}>
          <Sidebar.MenuButton>
            <ChevronRightIcon class="transition-transform" />
            {#if itemType === "geographic"}
              <EarthIcon />
            {/if}

            <a href={link} class="truncate grow">{name || "No name"}</a>
            {#if item.stats}
              <span class="text-muted-foreground">{item.stats.totalRoutes}</span>
            {/if}
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      {/snippet}
    </Collapsible.Trigger>

    <Collapsible.Content>
      <Sidebar.MenuSub>
        <AppSidebarChildren bind:item />
      </Sidebar.MenuSub>
    </Collapsible.Content>
  </Collapsible.Root>
{/if}
