<script lang="ts">
  import { resolve } from "$app/paths";
  import * as Collapsible from "#components/ui/collapsible";
  import * as Sidebar from "#components/ui/sidebar";
  import * as DropdownMenu from "#components/ui/dropdown-menu";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
  import EarthIcon from "@lucide/svelte/icons/earth";
  import CircleQuestionMarkIcon from "@lucide/svelte/icons/circle-question-mark";
  import BuildingIcon from "@lucide/svelte/icons/building";
  import type { DataTree } from "#lib/types.js";

  import { getName, featureToType } from "#lib/data/parse/data.js";
  import AppSidebarChildren from "./app-sidebar-children.svelte";
  import HolyGrade from "#components/grade/holy-grade.svelte";
  import { onMount } from "svelte";
  import { getGrade } from "#lib/data/parse/osm-tags.js";
  import type { OsmFeature } from "osm-api";
  import { page } from "$app/state";
  import clsx from "clsx";
  import { getAppState } from "#lib/data/app-state.js";

  let {
    slug,
    item = $bindable(),
  }: {
    slug: string;
    item: DataTree;
  } = $props();

  const appState = getAppState();

  const breadcrumbSlugs = $derived(appState.breadcrumbs.slugs);
  const tree = $derived(appState.tree);

  const isCurrentPage = $derived((page.params.slug ?? "") === slug);
  // Check if this specific node is part of the active path being viewed
  const isActivePath = $derived(isCurrentPage || breadcrumbSlugs.some((s) => s === slug));

  let open = $state(false);
  $effect(() => {
    if (isActivePath || isCurrentPage) open = true;
  });

  $effect(() => {
    if (open) appState.fetchChildren(slug);
  });

  onMount(() => appState.fetchStats(slug));

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
  <Collapsible.Root bind:open onmouseenter={() => appState.fetchChildren(slug)} class="w-full">
    <Collapsible.Trigger>
      {#snippet child({ props })}
        <Sidebar.MenuItem bind:ref={ref as HTMLLIElement} {...props} class="group/button">
          <Sidebar.MenuButton href={link}>
            <ChevronRightIcon class={clsx("transition-transform", open && "rotate-90")} />
            {#if itemType === "geographic"}
              <EarthIcon />
            {/if}

            <span class="truncate grow">{name || "No name"}</span>
          </Sidebar.MenuButton>

          {#if item.stats}
            <Sidebar.MenuBadge class="group-hover/button:hidden">
              {item.stats.totalRoutes}
            </Sidebar.MenuBadge>
          {/if}

          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Sidebar.MenuAction showOnHover {...props}>
                  <Ellipsis />
                </Sidebar.MenuAction>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content side="right" align="start">
              <DropdownMenu.Item>Add area</DropdownMenu.Item>
              <DropdownMenu.Item>Add route</DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item>Download area</DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item>Delete area</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </Sidebar.MenuItem>
      {/snippet}
    </Collapsible.Trigger>

    <Collapsible.Content>
      <Sidebar.MenuSub>
        <AppSidebarChildren bind:item {slug} />
      </Sidebar.MenuSub>
    </Collapsible.Content>
  </Collapsible.Root>
{/if}
