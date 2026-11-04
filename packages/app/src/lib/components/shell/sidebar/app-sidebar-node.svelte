<script lang="ts">
  import { resolve } from "$app/paths";
  import * as Collapsible from "#components/ui/collapsible/index.js";
  import * as Sidebar from "#components/ui/sidebar/index.js";
  import * as DropdownMenu from "#components/ui/dropdown-menu/index.js";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
  import EarthIcon from "@lucide/svelte/icons/earth";
  import CircleQuestionMarkIcon from "@lucide/svelte/icons/circle-question-mark";
  import BuildingIcon from "@lucide/svelte/icons/building";
  import type { DataTree } from "#lib/types.js";

  import { getName, featureToType } from "#lib/data/parse/data.js";
  import AppSidebarChildren from "./app-sidebar-children.svelte";
  import HolyGrade from "#components/grade/holy-grade.svelte";
  import { onMount, untrack } from "svelte";
  import { getGrade } from "#lib/data/parse/osm-tags.js";
  import type { OsmFeature } from "osm-api";
  import { page } from "$app/state";
  import clsx from "clsx";
  import { getAppState } from "#lib/data/app-state.js";
  import {
    canDropSidebarChild,
    dropSidebarChild,
    endSidebarDrag,
    getSearchFilter,
    startSidebarDrag,
    type ReorderableType,
  } from "./utils";
  import { getParentSlug } from "#lib/helpers/slug.js";
  import { goto } from "$app/navigation";
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";

  let {
    slug,
    item = $bindable(),
  }: {
    slug: string;
    item: DataTree;
  } = $props();

  const appState = getAppState();
  const searchFilter = getSearchFilter();

  const breadcrumbSlugs = $derived(appState.breadcrumbs.slugs);
  const tree = $derived(appState.tree);

  const isCurrentPage = $derived((page.params.slug ?? "") === slug);
  // Check if this specific node is part of the active path being viewed
  const isActivePath = $derived(isCurrentPage || breadcrumbSlugs.some((s) => s === slug));

  let open = $state(false);
  $effect(() => {
    if (isActivePath || isCurrentPage) open = true;
  });

  // Nodes opened by the search are closed again when it ends, so the full tree isn't rendered at once.
  let openedBySearch = false;
  $effect(() => {
    const expand = searchFilter.current.shouldExpand(slug);
    untrack(() => {
      if (expand) {
        if (!open) {
          open = true;
          openedBySearch = true;
        }
      } else if (openedBySearch) {
        openedBySearch = false;
        if (!isActivePath) open = false;
      }
    });
  });

  $effect(() => {
    if (open) appState.fetchChildren(slug);
  });

  let seenCollapseVersion = searchFilter.current.collapseVersion;
  $effect(() => {
    const version = searchFilter.current.collapseVersion;
    if (version === seenCollapseVersion) return;
    seenCollapseVersion = version;
    open = false;
  });

  onMount(() => appState.fetchStats(slug));

  const link = $derived.by(() => {
    return resolve("/world/[...slug]", { slug });
  });
  const name = $derived(getName(item.feature));

  const itemType = $derived(featureToType(item.feature));
  const reorderType = $derived<ReorderableType | undefined>(
    itemType === "route" ? "route" : itemType === "area" ? "area" : undefined,
  );
  const parentSlug = $derived(getParentSlug(slug) ?? "");

  let ref = $state<HTMLElement | null>(null);

  // The action menu is costly to mount for every node, so it only exists once the node is hovered or focused.
  let interacted = $state(false);

  function onDragStart(event: DragEvent) {
    if (!reorderType) return;
    startSidebarDrag(parentSlug, reorderType, slug);
    event.dataTransfer?.setData("text/plain", slug);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(event: DragEvent) {
    if (!reorderType || !canDropSidebarChild(parentSlug, reorderType, slug)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  }

  function onDrop(event: DragEvent) {
    if (!reorderType || !canDropSidebarChild(parentSlug, reorderType, slug)) return;
    event.preventDefault();
    const parent = appState.tree.getReactiveNode(parentSlug);
    if (parent) dropSidebarChild(parent, parentSlug, reorderType, slug);
    endSidebarDrag();
  }

  function onDragEnd() {
    endSidebarDrag();
  }

  async function addRoute() {
    const newSlug = appState.createRoute(item, slug);
    await goto(resolve("/world/[...slug]", { slug: newSlug }));
  }

  async function addSector() {
    const newSlug = appState.createArea(item, slug);
    await goto(resolve("/world/[...slug]", { slug: newSlug }));
  }

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
    draggable={reorderType !== undefined}
    ondragstart={onDragStart}
    ondragover={onDragOver}
    ondrop={onDrop}
    ondragend={onDragEnd}
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
    {#if reorderType}
      <GripVerticalIcon class="ml-auto size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    {/if}
  </Sidebar.MenuButton>
{:else}
  <Collapsible.Root
    bind:open
    onmouseenter={() => {
      interacted = true;
      appState.fetchChildren(slug);
    }}
    onfocusin={() => (interacted = true)}
    class="w-full"
  >
    <Collapsible.Trigger>
      {#snippet child({ props })}
        <Sidebar.MenuItem bind:ref={ref as HTMLLIElement} {...props} class="group/button">
          <Sidebar.MenuButton
            href={link}
            draggable={reorderType !== undefined}
            ondragstart={onDragStart}
            ondragover={onDragOver}
            ondrop={onDrop}
            ondragend={onDragEnd}
          >
            <ChevronRightIcon class={clsx("transition-transform", open && "rotate-90")} />
            {#if itemType === "geographic"}
              <EarthIcon />
            {/if}

            <span class="truncate grow">{name || "No name"}</span>
            {#if reorderType}
              <GripVerticalIcon class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            {/if}
          </Sidebar.MenuButton>

          {#if item.stats}
            <Sidebar.MenuBadge class="group-hover/button:hidden">
              {item.stats.totalRoutes}
            </Sidebar.MenuBadge>
          {/if}

          {#if interacted}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                {#snippet child({ props })}
                  <Sidebar.MenuAction showOnHover {...props}>
                    <Ellipsis />
                  </Sidebar.MenuAction>
                {/snippet}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content side="right" align="start">
                {#if appState.osmUser.loggedIn && itemType === "area"}
                  <DropdownMenu.Item onclick={addSector}>Add sector</DropdownMenu.Item>
                  <DropdownMenu.Item onclick={addRoute}>Add route</DropdownMenu.Item>
                  <DropdownMenu.Separator />
                {/if}
                <DropdownMenu.Item>Download images</DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item>Delete area</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          {/if}
        </Sidebar.MenuItem>
      {/snippet}
    </Collapsible.Trigger>

    <Collapsible.Content>
      {#if open}
        <Sidebar.MenuSub>
          <AppSidebarChildren bind:item {slug} />
        </Sidebar.MenuSub>
      {/if}
    </Collapsible.Content>
  </Collapsible.Root>
{/if}
