<script lang="ts">
  import { resolve } from "$app/paths";
  import * as Collapsible from "@/ui/collapsible/index.js";
  import * as Sidebar from "@/ui/sidebar/index.js";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import { page } from "$app/state";
  import type { TreeNode, BreadcrumbSegment } from "$lib/types";

  // Using a self-import to make the component recursive!
  import AppSidebarNode from "./app-sidebar-node.svelte";

  let {
    item,
    breadcrumbs,
    rootPath = "world"
  }: {
    item: TreeNode;
    breadcrumbs: BreadcrumbSegment[];
    rootPath?: string;
  } = $props();

  // Check if this specific node is part of the active path being viewed
  let isActivePath = $derived(breadcrumbs.some((b) => b.link.includes(item.path)));
  let isCurrentPage = $derived(breadcrumbs.at(-1)?.link.includes(item.path));

  // Initialize with pre-fetched data from the load function if it exists
  let children = $state<TreeNode[]>([]);
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
    if (open && children.length === 0 && item.hasChildren) {
      isLoading = true;
      try {
        const res = await fetch(`/api/${item.path}/tree.json`);
        if (res.ok) {
          children = await res.json();
        }
      } finally {
        isLoading = false;
      }
    }
  }

  function getLink(path: string) {
    // Convert "world/canada" to "/World/canada"
    const prefix = rootPath;
    const displayName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
    const relativePath = path.replace(new RegExp(`^${prefix}/?`), "");
    return relativePath ? `/${displayName}/${relativePath}` : `/${displayName}`;
  }
</script>

{#if item.type === "route" || item.type === "node" || !item.hasChildren}
  <Sidebar.MenuButton isActive={isCurrentPage} class="data-[active=true]:bg-transparent">
    <!-- Optional: Add grade or icon here -->
    <a href={getLink(item.path)}>{item.name}</a>
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
            <a href={getLink(item.path)}>{item.name}</a>
          </Sidebar.MenuButton>
        {/snippet}
      </Collapsible.Trigger>

      <Collapsible.Content>
        <Sidebar.MenuSub>
          {#if isLoading}
            <Sidebar.MenuSubItem class="text-xs text-muted-foreground pl-4">Loading...</Sidebar.MenuSubItem>
          {:else}
            {#each children as child (child.id)}
              <AppSidebarNode item={child} {breadcrumbs} {rootPath} />
            {/each}
          {/if}
        </Sidebar.MenuSub>
      </Collapsible.Content>
    </Collapsible.Root>
  </Sidebar.MenuItem>
{/if}
