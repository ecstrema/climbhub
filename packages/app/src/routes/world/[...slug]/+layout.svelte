<script lang="ts">
  import type { WithChildren } from "bits-ui";

  import * as Breadcrumb from "@/ui/breadcrumb/index.js";
  import AppSidebar from "@/sidebar/app-sidebar.svelte";
  import { Separator } from "@/ui/separator";
  import * as Sidebar from "@/ui/sidebar";
  import { OSMProvider } from "@/osm";
  import SettingsMenu from "@/setings-menu/settings-menu.svelte";

  import { getName } from "$lib/data";
  import { resolve } from "$app/paths";
  import type { BreadcrumbSegment, DataJSON, DataJSONRecord, RecursiveData } from "$lib/types";

  import type { PageProps } from "./$types";
  import { rootElement } from "./root";

  const { children, data, params }: WithChildren<PageProps> = $props();

  const segments: string[] = $derived.by(() => {
    const slug = params.slug;
    if (!slug) {
      return [];
    }
    let acc: string[] = [];
    return slug.split("/").map((segment) => {
      acc.push(segment);
      return acc.join("/");
    });
  });

  const breadcrumbs: BreadcrumbSegment[] = $derived.by(() => {
    return segments.map((slug) => {
      return { slug, data: data.data?.[slug] };
    });
  });

  const tree: RecursiveData<DataJSON> = $state(rootElement);

  const parentMap: Record<string, RecursiveData<DataJSON>> = {
    "": tree,
  };

  function integrateIf() {
    if (data.data) {
      integrateIntoTree(data.data);
    }
  }

  integrateIf();
  $effect(integrateIf);

  function integrateIntoTree(source: DataJSONRecord) {
    // We need to sort the slugs to ensure that parents are processed before children. This way, we can always find the parent in the parentMap when processing a child.
    const sortedEntries = Object.entries(source)
      .filter(([slug, _d]) => !parentMap[slug]) // only process slugs that are not already in the parentMap
      .sort(([a, _a], [b, _b]) => a.split("/").length - b.split("/").length);
    for (const [slug, data] of sortedEntries) {
      // get the parent slug by removing the last segment of the current slug
      const parentSlug = slug.split("/").slice(0, -1).join("/");
      const parent = parentMap[parentSlug];
      if (!parent) {
        console.warn(`Parent not found for slug: ${slug}`);
        continue;
      }

      const self = { own: data };
      if (!parent.children) {
        parent.children = {};
      }

      parent.children[slug] = self;
      parentMap[slug] = self;
    }
  }
</script>

<OSMProvider>
  <Sidebar.Provider>
    <AppSidebar {breadcrumbs} {tree} />

    <Sidebar.Inset>
      <header class="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Sidebar.Trigger class="-ms-1" />
        <Separator orientation="vertical" class="me-2 data-[orientation=vertical]:h-4" />

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
                    <Breadcrumb.Link
                      href={resolve("/world/[...slug]", {
                        slug: breadcrumb.slug,
                      })}
                    >
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
        <SettingsMenu />
      </header>

      <div class="flex flex-1 flex-col gap-4 p-4">
        {@render children?.()}
      </div>
    </Sidebar.Inset>
  </Sidebar.Provider>
</OSMProvider>
