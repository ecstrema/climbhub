<script lang="ts">
  import AppSidebar from "@/app-sidebar.svelte";
  import * as Sidebar from "@/ui/sidebar";

  import { page } from "$app/state";

  const { data, children } = $props();
</script>

<Sidebar.Provider>
  <AppSidebar dataTree={data.dataTree} breadcrumbs={page.data.breadcrumbs} />
  <Sidebar.Inset>
    {@render children()}
  </Sidebar.Inset>
</Sidebar.Provider>
