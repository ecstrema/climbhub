<script lang="ts">
  import * as Sidebar from "@/ui/sidebar/index.js";
  import type { ComponentProps } from "svelte";
  import AppSidebarNode from "./app-sidebar-node.svelte";
  import type { BreadcrumbSegment, DataJSON, RecursiveData } from "$lib/types";

  let {
    tree,
    breadcrumbs,
    ref = $bindable(null),
    ...restProps
  }: ComponentProps<typeof Sidebar.Root> & {tree: RecursiveData<DataJSON>; breadcrumbs: BreadcrumbSegment[]} = $props();
</script>

<Sidebar.Root bind:ref {...restProps}>
  <Sidebar.Content>
    <Sidebar.Group>
      <Sidebar.GroupLabel>Regions & Areas</Sidebar.GroupLabel>
      <Sidebar.GroupContent>
        <Sidebar.Menu>
          <AppSidebarNode item={tree} slug={""} breadcrumbs={breadcrumbs}/>
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>
  </Sidebar.Content>
  <Sidebar.Rail />
</Sidebar.Root>
