<script lang="ts">
  import * as Sidebar from "@/ui/sidebar/index.js";
  import type { ComponentProps } from "svelte";
  import { page } from "$app/state";
  import AppSidebarNode from "./app-sidebar-node.svelte";

  interface AppSidebarProps {
    breadcrumbs?: { name: string; link: string }[];
    rootPath?: string;
  }

  let {
    ref = $bindable(null),
    breadcrumbs = [],
    rootPath = "world",
    ...restProps
  }: ComponentProps<typeof Sidebar.Root> & AppSidebarProps = $props();

  // Root tree is natively populated by src/routes/+layout.ts
  let rootTree = $derived(page.data.rootTree || []);
</script>

<Sidebar.Root bind:ref {...restProps}>
  <Sidebar.Content>
    <Sidebar.Group>
      <Sidebar.GroupLabel>Regions & Areas</Sidebar.GroupLabel>
      <Sidebar.GroupContent>
        <Sidebar.Menu>
          {#each rootTree as item (item.id)}
            <AppSidebarNode {item} {breadcrumbs} {rootPath} />
          {/each}
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>
  </Sidebar.Content>
  <Sidebar.Rail />
</Sidebar.Root>
