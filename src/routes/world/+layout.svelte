<script lang="ts">
  import { asset, resolve } from "$app/paths";
  import { page } from "$app/state"
  import type { BreadcrumbSegment, DataJSON } from "$lib/types";

  import * as Breadcrumb from "@/ui/breadcrumb/index.js";
  import AppSidebar from "@/sidebar/app-sidebar.svelte";
  import { Separator } from "@/ui/separator";
  import * as Sidebar from "@/ui/sidebar";
    import { getName } from "$lib/data";
    import { onMount } from "svelte";

  const { children } = $props();

  class FetchingBreadcrumbSegment implements BreadcrumbSegment {
    link: string
    name: string
    // This expects the slug, not the path, so not including /world/
    constructor(slug: string, tempName: string) {
      this.link = $state(slug)
      this.name = $state(tempName)

      onMount(() => {
        // TODO: since this is in an effect, it is not done during serverside rendering, so names are incorrect
        $effect(() => {
          fetch(asset(`/api/world${slug}/data.json`)).then(async (res) => {
            if (res.ok) {
              const data: DataJSON = await res.json()
              const name = getName(data);
              if (name) {
                this.name = name;
              }
            }
          })
        })
      })
    }
  }

  // Derive breadcrumbs reactively whenever the user navigates
  let breadcrumbs: BreadcrumbSegment[] = $derived.by(() => {
    const slug = page.params.slug;
    if (!slug) {
      return [];
    }

    let acc = "";
    const segments = slug.split("/").map((segment) => {
      acc += "/" + segment;
      return new FetchingBreadcrumbSegment(acc, segment);
    })

    return segments;
  })
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
