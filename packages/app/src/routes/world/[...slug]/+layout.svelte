<script lang="ts">
  import AppTopNavigation from "#lib/components/shell/app-top-navigation.svelte";

  import type { WithChildren } from "bits-ui";

  import AppSidebar from "#components/shell/sidebar/app-sidebar.svelte";
  import { Separator } from "#components/ui/separator/index.js";
  import * as Sidebar from "#components/ui/sidebar/index.js";
  import AppProvider from "#components/shell/providers/app-provider.svelte";
  import SettingsMenu from "#components/shell/app-settings-menu.svelte";

  import type { LayoutProps } from "./$types";
  import Head from "#components/shell/head.svelte";
  import type { LayoutLoadType } from "./+layout";
  import OsmChanges from "#components/shell/osm-changes.svelte";

  const { children, params, data }: WithChildren<LayoutProps> & { data: LayoutLoadType } = $props();
</script>

<AppProvider slug={params.slug} currentItem={data.currentItem} additionalDataJSON={data.additionalData}>
  <Head />
  <Sidebar.Provider>
    <AppSidebar />

    <Sidebar.Inset>
      <header class="flex h-16 shrink-0 items-center gap-2 border-b px-4 max-w-screen overflow-auto no-scrollbar">
        <Sidebar.Trigger class="-ms-1" />
        <Separator orientation="vertical" class="me-2 data-[orientation=vertical]:h-4" />

        <AppTopNavigation />
        <div class="grow"></div>
        <SettingsMenu />
      </header>

      <div class="flex flex-1 flex-col gap-4 p-4">
        {@render children?.()}
      </div>
    </Sidebar.Inset>
  </Sidebar.Provider>
  <OsmChanges />
</AppProvider>
