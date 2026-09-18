<script lang="ts">
  import AppTopNavigation from "$lib/components/shell/app-top-navigation.svelte";

  import type { WithChildren } from "bits-ui";

  import AppSidebar from "@/shell/sidebar/app-sidebar.svelte";
  import { Separator } from "@/ui/separator";
  import * as Sidebar from "@/ui/sidebar";
  import { AppProvider } from "@/shell/providers";
  import SettingsMenu from "@/shell/app-settings-menu.svelte";

  import type { LayoutProps } from "./$types";
  import Head from "@/shell/head.svelte";
  import type { LayoutLoadType } from "./+layout";
  import OsmChanges from "@/shell/osm-changes.svelte";

  const { children, params, data }: WithChildren<LayoutProps> & { data: LayoutLoadType } = $props();
</script>

<AppProvider slug={params.slug} currentItem={data.currentItem} additionalDataJSON={data.additionalData}>
  <Head />
  <Sidebar.Provider>
    <AppSidebar />

    <Sidebar.Inset>
      <header
        class="flex h-16 shrink-0 items-center gap-2 border-b px-4 max-w-screen overflow-auto no-scrollbar"
      >
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
