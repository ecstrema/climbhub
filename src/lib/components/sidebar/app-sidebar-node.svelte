<script lang="ts">
  import { asset, resolve } from "$app/paths";
  import * as Collapsible from "@/ui/collapsible/index.js";
  import * as Sidebar from "@/ui/sidebar/index.js";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import type { BreadcrumbSegment, DataJSON, RecursiveData } from "$lib/types";

  // Using a self-import to make the component recursive!
  import AppSidebarNode from "./app-sidebar-node.svelte";
  import { getName, recursiveDataJSONFromRecord } from "$lib/data";

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
      resolve("/api/world/[...slug]/shallow.json", { slug }),
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
  <Sidebar.MenuButton
    isActive={isCurrentPage}
    class="data-[active=true]:bg-transparent"
  >
    <!-- Optional: Add grade or icon here -->
    <a href={link}>{name || "No name"}</a>
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
            <a href={link}>{name || "No name"}</a>
          </Sidebar.MenuButton>
        {/snippet}
      </Collapsible.Trigger>

      <Collapsible.Content>
        <Sidebar.MenuSub>
          {#await children}
            <Sidebar.MenuSubItem class="text-xs text-muted-foreground pl-4">
              Loading...
            </Sidebar.MenuSubItem>
          {:then children}
            {#if children}
              {#each Object.entries(children) as [slug, child] (slug)}
                <AppSidebarNode item={child} {breadcrumbs} {slug} />
              {/each}
            {/if}
          {/await}
        </Sidebar.MenuSub>
      </Collapsible.Content>
    </Collapsible.Root>
  </Sidebar.MenuItem>
{/if}
