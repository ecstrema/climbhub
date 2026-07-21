<script lang="ts">
  import { resolve } from "$app/paths";
  import * as Breadcrumb from "@/ui/breadcrumb/index.js";
  import AppSidebar from "@/sidebar/app-sidebar.svelte";
  import { Separator } from "@/ui/separator";
  import * as Sidebar from "@/ui/sidebar";

  const { children } = $props();

  // Derive breadcrumbs reactively whenever the user navigates
  let breadcrumbs: {name: string, link: string}[] = []
</script>

<Sidebar.Provider>
  <AppSidebar {breadcrumbs} />

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
              <Breadcrumb.Item>
                {#if index === lastElementIndex}
                  <Breadcrumb.Page>{breadcrumb.name}</Breadcrumb.Page>
                {:else}
                  <Breadcrumb.Link href={resolve(breadcrumb.link as any)}>
                    {breadcrumb.name}
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
    </header>

    <div class="flex flex-1 flex-col gap-4 p-4">
      {@render children()}
    </div>
  </Sidebar.Inset>
</Sidebar.Provider>
