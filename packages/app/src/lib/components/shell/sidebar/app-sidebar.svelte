<script lang="ts">
  import * as Sidebar from "@/ui/sidebar";
  import type { ComponentProps } from "svelte";
  import { featureToType, getName } from "$lib/data";
  import { resolve } from "$app/paths";
  import AppSidebarChildren from "./app-sidebar-children.svelte";
  import MagnifyingGlass from "@lucide/svelte/icons/search";

  import { getTree } from "@/shell/providers";
  import Input from "@/ui/input/input.svelte";
  import type { DataTree } from "$lib/types";
  import { setSearchFilter, type SearchFilter } from "./utils";

  let { ref = $bindable(null), ...restProps }: ComponentProps<typeof Sidebar.Root> & {} = $props();

  const tree = getTree();

  let searchQuery = $state("");

  const searchFilter: SearchFilter = $derived((d: DataTree): boolean => {
    if (!searchQuery) return true;
    const t = featureToType(d.feature);
    if (t === "route" || t === "gym") {
      return getName(d.feature)?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false;
    }
    // recursively check children for matches
    // TODO: this is far from optimal. We should use a bottom-up approach or single pass filtering instead.
    // In fact, this currently only shows the items that have been added to tree. So it completely ignores the download items that have not been shown in this session.
    // Instead, we should query the db for all items matching our key.
    // If we want proper search, we will probably need to add a dependency on a minimal search engine, like lunr, fuse or minisearch or flexsearch.
    if (d.children) {
      return Object.values(d.children).some((child) => searchFilter(child));
    }
    return false;
  });

  setSearchFilter({
    get current() {
      return searchFilter;
    },
  });
</script>

<Sidebar.Root bind:ref {...restProps}>
  <Sidebar.Header>
    <Input placeholder="Search..." class="w-full" bind:value={searchQuery} />
  </Sidebar.Header>
  <Sidebar.Content>
    <Sidebar.Group>
      <Sidebar.GroupLabel>
        <a href={resolve("/world")}>{getName(tree.root.feature)}</a>
      </Sidebar.GroupLabel>
      <Sidebar.GroupContent>
        <Sidebar.Menu>
          <AppSidebarChildren bind:item={tree.root} slug={""} />
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>
  </Sidebar.Content>
  <Sidebar.Rail />
</Sidebar.Root>
