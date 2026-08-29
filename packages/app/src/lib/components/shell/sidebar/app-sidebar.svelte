<script lang="ts">
  import * as Sidebar from "@/ui/sidebar/index.js";
  import type { ComponentProps } from "svelte";
  import { getName } from "$lib/data";
  import { resolve } from "$app/paths";
  import AppSidebarChildren from "./app-sidebar-children.svelte";

  import { getBreadcrumbs, getTree } from "@/shell/providers";

  let { ref = $bindable(null), ...restProps }: ComponentProps<typeof Sidebar.Root> & {} = $props();

  const tree = getTree();
  const breadcrumbs = getBreadcrumbs();
</script>

<Sidebar.Root bind:ref {...restProps}>
  <Sidebar.Content>
    <Sidebar.Group>
      <Sidebar.GroupLabel>
        <a href={resolve("/world")}>{getName(tree.current.feature)}</a>
      </Sidebar.GroupLabel>
      <Sidebar.GroupContent>
        <Sidebar.Menu>
          <AppSidebarChildren bind:item={tree.current} breadcrumbs={breadcrumbs.current} />
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>
  </Sidebar.Content>
  <Sidebar.Rail />
</Sidebar.Root>
