<script lang="ts">
  import type { BreadcrumbSegment, DataJSONRecord, DataTree } from "$lib/types";
  import { type Snippet } from "svelte";
  import { AppState, setAppState, type Breadcrumbs } from "$lib/data/app-state";
  import { browser } from "$app/env";
  import { type OsmFeature } from "osm-api";
  import { untrack } from "svelte";
  import { getParentSlugs } from "$lib/helpers/slug";
  import { AppDataTree } from "$lib/data/app-data-tree.svelte";
  import type { FromCurrent } from "./types";

  const {
    children,
    slug = "",
    currentItem,
    additionalDataJSON,
  }: {
    children: Snippet;
    slug?: string;
    currentItem: DataTree;
    additionalDataJSON: DataJSONRecord;
  } = $props();

  // svelte-ignore state_referenced_locally: We need to get the root "World" slug, which is is either the current item if slug is "", or the grandest parent of the current item if slug.
  const appDataTree = new AppDataTree(slug === "" ? currentItem : { feature: additionalDataJSON[""]! });

  const slugSegments: string[] = $derived.by(() => getParentSlugs(slug));
  const breadcrumbItems: BreadcrumbSegment[] = $derived.by(() => {
    return slugSegments.map((slug) => ({ slug, data: appDataTree.getReactiveNode(slug) }));
  });

  const breadcrumbs: Breadcrumbs = {
    get slugs() {
      return slugSegments;
    },
    get items() {
      return breadcrumbItems;
    },
  };

  const currentNode: FromCurrent<DataTree> = {
    get current() {
      return appDataTree.getReactiveNode(slug) ?? currentItem;
    },
  };

  const appState = new AppState(appDataTree, breadcrumbs, currentNode);

  // svelte-ignore state_referenced_locally
  // We need to integrate the data outside of the effect to ensure that the data is available for the initial render. This is important for SSR and hydration.
  appDataTree.integrateElementsIntoTree(additionalDataJSON);
  $effect(() => appDataTree.integrateElementsIntoTree(additionalDataJSON));

  const integrateSelfIntoTree = () => {
    const c = currentItem;
    untrack(() => appDataTree.integrateNodeIntoTree(c, slug));
  };

  integrateSelfIntoTree();
  $effect(() => integrateSelfIntoTree());

  // When navigating to a page, load it directly from OSM to see if it has changed.
  $effect(() => {
    if (!browser) return;
    // We need this effect to rerun when the slug changes
    const _ = slug;

    if (currentItem.feature.type === "geographic") return;

    untrack(() => {
      // Pass the correctly proxied item to the refresh function
      const reactiveItem = appDataTree.getReactiveNode(slug);
      if (reactiveItem) {
        appState.osmUser.refreshItem(reactiveItem as DataTree<OsmFeature>);
      }
    });
  });

  setAppState(appState);
</script>

{@render children?.()}
