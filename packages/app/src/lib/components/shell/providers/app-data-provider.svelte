<script lang="ts">
  import type { BreadcrumbSegment, DataJSONRecord, DataTree } from "$lib/types";
  import { type Snippet } from "svelte";
  import {
    AppDataTree,
    setBreadcrumbs,
    setCurrentNode,
    setRefreshState,
    setTree,
  } from "./app-data.svelte";
  import { browser } from "$app/env";
  import { type OsmFeature } from "osm-api";
  import { untrack } from "svelte";
  import { osmUser } from "./osm.svelte";
  import { getParentSlugs } from "$lib/slug";

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

  let refreshCount = $state(0);
  let osmRefreshComplete = $state(false);

  // When navigating to a page, load it directly from OSM to see if it has changed.
  $effect(() => {
    if (!browser) return;
    // We need this effect to rerun when the slug changes
    const _ = slug;

    if (currentItem.feature.type === "geographic") return;

    osmRefreshComplete = false;
    untrack(() => {
      const generation = refreshCount;
      refreshCount += 1;

      // Pass the correctly proxied item to the refresh function
      const proxyItem = appDataTree.parentMap[slug];
      if (proxyItem) {
        osmUser.refreshItem(proxyItem as DataTree<OsmFeature>);
      }

      if (generation === refreshCount) osmRefreshComplete = true;
    });
  });

  const breadcrumbItems: BreadcrumbSegment[] = $derived.by(() => {
    return slugSegments.map((slug) => ({ slug, data: appDataTree.parentMap[slug] }));
  });

  setCurrentNode({
    get current() {
      return appDataTree.parentMap[slug] || currentItem;
    },
  });

  setBreadcrumbs({
    get slugs() {
      return slugSegments;
    },
    get items() {
      return breadcrumbItems;
    },
  });

  setTree(appDataTree);

  setRefreshState({
    get osmRefreshComplete() {
      return osmRefreshComplete;
    },
    get refreshCount() {
      return refreshCount;
    },
  });
</script>

{@render children?.()}
