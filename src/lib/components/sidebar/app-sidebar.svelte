<script lang="ts">
  import * as Sidebar from "@/ui/sidebar/index.js";
  import type { ComponentProps } from "svelte";
  import type { BreadcrumbSegment, DataJSON, RecursiveData } from "$lib/types";
  import { getName } from "$lib/data";
  import { resolve } from "$app/paths";
  import AppSidebarChildren from "./app-sidebar-children.svelte";

  let {
    tree,
    breadcrumbs,
    ref = $bindable(null),
    ...restProps
  }: ComponentProps<typeof Sidebar.Root> & {
    tree: RecursiveData<DataJSON>;
    breadcrumbs: BreadcrumbSegment[];
  } = $props();
</script>

<Sidebar.Root bind:ref {...restProps}>
  <Sidebar.Content>
    <Sidebar.Group>
      <Sidebar.GroupLabel>
        <a href={resolve("/world")}>{getName(tree.own)}</a>
      </Sidebar.GroupLabel>
      <Sidebar.GroupContent>
        <Sidebar.Menu>
          <AppSidebarChildren children={tree.children} {breadcrumbs} />
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>
  </Sidebar.Content>
  <Sidebar.Rail />
</Sidebar.Root>
