<script lang="ts">
  import { resolve } from "$app/paths";
  import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
  import AppSidebar from "@/app-sidebar.svelte";
  import { Separator } from "@/ui/separator";
  import { getNodeSegments } from "$lib/data";

  import * as Sidebar from "@/ui/sidebar";

  import { page } from "$app/state";

  const { data, children } = $props();

  import type { TreeNode } from "$lib/types";
</script>

<Sidebar.Provider>
  {@const currentNode: TreeNode = page.data.currentNode || data.dataTree}
  {@const breadcrumbs = getNodeSegments(currentNode)}
  <AppSidebar dataTree={data.dataTree} {breadcrumbs} />
  <Sidebar.Inset>
    <header class="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <Sidebar.Trigger class="-ms-1" />
      <Separator
        orientation="vertical"
        class="me-2 data-[orientation=vertical]:h-4"
      />
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
    </header>
    <div class="flex flex-1 flex-col gap-4 p-4">
      {@render children()}
    </div>
  </Sidebar.Inset>
</Sidebar.Provider>
