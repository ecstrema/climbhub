<script lang="ts">
  import { asset, resolve } from "$app/paths";
  import * as Collapsible from "@/ui/collapsible/index.js";
  import * as Sidebar from "@/ui/sidebar/index.js";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import { page } from "$app/state";
  import type { DataJSON, BreadcrumbSegment } from "$lib/types";

  // Using a self-import to make the component recursive!
  import AppSidebarNode from "./app-sidebar-node.svelte";

  let {
    item,
    breadcrumbs
  }: {
    item: DataJSON;
    breadcrumbs: BreadcrumbSegment[];
  } = $props();

  // Check if this specific node is part of the active path being viewed
  let isActivePath = $derived(breadcrumbs.some((b) => b.link.includes(item.path)));
  let isCurrentPage = $derived(breadcrumbs.at(-1)?.link.includes(item.path));

  // Initialize with pre-fetched data from the load function if it exists
  let children = $state<ElementsJSON[]>([]);
  let isLoading = $state(false);
  let isOpen = $state(false);

  // Sync with page data and active path
  $effect(() => {
    const prefetched = page.data.expandedTrees?.[item.path] || [];
    if (prefetched.length > 0) {
      children = prefetched;
    }
  });

  $effect(() => {
    if (isActivePath) {
      isOpen = true;
    }
  });

  // Lazy-load the children when the user clicks the folder toggle
  async function handleOpenChange(open: boolean) {
    isOpen = open;
    if (open && children.length === 0) {
      isLoading = true;
      try {
        const res = await fetch(asset(`/api/${item.path}/tree.json`));
        if (res.ok) {
          children = await res.json();
        }
      } finally {
        isLoading = false;
      }
    }
  }

</script>

{#if item.type === "node"}
  <Sidebar.MenuButton isActive={isCurrentPage} class="data-[active=true]:bg-transparent">
    <!-- Optional: Add grade or icon here -->
    <a href={resolve(item.path)}>{item.name}</a>
  </Sidebar.MenuButton>
{:else}
  <Sidebar.MenuItem>
    <Collapsible.Root
      open={isOpen}
      onOpenChange={handleOpenChange}
      class="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
    >
      <Collapsible.Trigger>
        {#snippet child({ props })}
          <Sidebar.MenuButton {...props}>
            <ChevronRightIcon class="transition-transform" />
            <a href={resolve(item.path)}>{item.name}</a>
          </Sidebar.MenuButton>
        {/snippet}
      </Collapsible.Trigger>

      <Collapsible.Content>
        <Sidebar.MenuSub>
          {#if isLoading}
            <Sidebar.MenuSubItem class="text-xs text-muted-foreground pl-4">Loading...</Sidebar.MenuSubItem>
          {:else}
            {#each children as child (child.path)}
              <AppSidebarNode item={child} {breadcrumbs} />
            {/each}
          {/if}
        </Sidebar.MenuSub>
      </Collapsible.Content>
    </Collapsible.Root>
  </Sidebar.MenuItem>
{/if}
