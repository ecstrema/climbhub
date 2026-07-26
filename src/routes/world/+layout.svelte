<script lang="ts">
  import type { WithChildren } from "bits-ui";

  import * as Breadcrumb from "@/ui/breadcrumb/index.js";
  import AppSidebar from "@/sidebar/app-sidebar.svelte";
  import { Separator } from "@/ui/separator";
  import * as Sidebar from "@/ui/sidebar";
  import AppThemeToggle from "@/theme-toggle/app-theme-toggle.svelte";

  import type { PageProps } from "./$types";
  import { getName } from "$lib/data";
  import { resolve } from "$app/paths";

  const { children, data }: WithChildren<PageProps> = $props();

  const breadcrumbs = $derived(data.breadcrumbs || []);
</script>

<Sidebar.Provider>
  <AppSidebar {breadcrumbs} tree={data.tree!}/>

  <Sidebar.Inset>
    <header class="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <Sidebar.Trigger class="-ms-1" />
      <Separator
        orientation="vertical"
        class="me-2 data-[orientation=vertical]:h-4"
      />

      {#if breadcrumbs.length > 0}
        <Breadcrumb.Root>
          <Breadcrumb.List>
            {@const lastElementIndex = breadcrumbs.length - 1}
            {#each breadcrumbs as breadcrumb, index}
              {@const name = getName(breadcrumb.data)}

              <Breadcrumb.Item>
                {#if index === lastElementIndex}
                  <Breadcrumb.Page>{name}</Breadcrumb.Page>
                {:else}
                  <Breadcrumb.Link href={resolve("/world/[...slug]", {slug: breadcrumb.slug})}>
                    {name}
                  </Breadcrumb.Link>
                {/if}
              </Breadcrumb.Item>
              {#if index !== lastElementIndex}
                <Breadcrumb.Separator />
              {/if}
            {/each}
          </Breadcrumb.List>
        </Breadcrumb.Root>
      {/if}
      <div class="grow"></div>
      <AppThemeToggle />
    </header>

    <div class="flex flex-1 flex-col gap-4 p-4">
      {@render children?.()}
    </div>
  </Sidebar.Inset>
</Sidebar.Provider>
