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

  const appDataTree = new AppDataTree();

  // Reusing the segments from the parents object works because key instertion order is preseserved since ES2015.
  const slugSegments: string[] = $derived.by(() => ["", ...getParentSlugs(slug)]);

  // svelte-ignore state_referenced_locally
  $effect.pre(() => appDataTree.integrateElementsIntoTree(additionalDataJSON));
  $effect.pre(() => {
    const c = $state.snapshot(currentItem);
    untrack(() => {
      appDataTree.integrateNodeIntoTree(c, slug);
    });
  });

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
      return currentItem;
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
