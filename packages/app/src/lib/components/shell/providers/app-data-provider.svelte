<script lang="ts">
  import type { BreadcrumbSegment, DataJSONRecord, DataTree } from "$lib/types";
  import { type Snippet } from "svelte";
  import { setBreadcrumbs, setCurrentNode, setRefreshState, setTree } from "./app-data.svelte";
  import { browser } from "$app/environment";
  import { type OsmFeature } from "osm-api";
  import { untrack } from "svelte";
  import { getOsmUser } from "./osm.svelte";
  import { dataClient } from "$lib/data-client";

  const {
    children,
    slug = "",
    currentItem,
    parents,
  }: {
    children: Snippet;
    slug?: string;
    currentItem: DataTree;
    parents: DataJSONRecord;
  } = $props();

  const segments: string[] = $derived.by(() => ["", ...Object.keys(parents)]);

  let tree: DataTree = $state({
    feature: { type: "geographic", name: "World" },
  });

  const parentMap: Record<string, DataTree> = {
    // svelte-ignore state_referenced_locally we can ignore this, because we should never be setting tree.
    // In fact, the only place we set it is below, in setTree().
    // If we don't add a setter in setTree, we get a svelte warning of binding to a non reactive property.
    "": tree,
  };

  // svelte-ignore state_referenced_locally
  integrateIntoTree(parents);
  $effect(() => integrateIntoTree(parents));

  // Sync currentItem into the tree directly on navigation
  $effect(() => {
    // Read dependencies outside untrack so the effect re-runs on navigation
    const currentSlug = slug;
    const incomingItem = currentItem;
    const parentSlug = segments.at(-1) || "";

    untrack(() => {
      const parent = parentMap[parentSlug];

      if (parent) {
        parent.children ??= {};

        if (parent.children[currentSlug]) {
          // Merge detailed data into lightweight placeholder
          parent.children[currentSlug].feature = incomingItem.feature;
          parent.children[currentSlug].stats = incomingItem.stats;
          parent.children[currentSlug].children = incomingItem.children;
          parent.children[currentSlug].childrenFetched = true;
        } else {
          // Insert the raw object directly into the reactive tree
          parent.children[currentSlug] = {
            ...incomingItem,
            childrenFetched: true,
          };
        }

        // Extract the newly created proxy back into the lookup map
        parentMap[currentSlug] = parent.children[currentSlug];
      } else {
        // Root fallback
        tree.feature = incomingItem.feature;
        tree.stats = incomingItem.stats;
        tree.children = incomingItem.children;
        tree.childrenFetched = true;
        parentMap[currentSlug] = tree;
      }

      // Ensure new children are registered in the map as proxies
      const activeProxy = parentMap[currentSlug];
      if (activeProxy.children) {
        for (const [childSlug, childNode] of Object.entries(activeProxy.children)) {
          parentMap[childSlug] = childNode;
        }
      }
    });
  });

  let refreshCount = $state(0);
  let osmRefreshComplete = $state(false);

  const osmUser = getOsmUser();

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
      const proxyItem = parentMap[slug];
      if (proxyItem) {
        osmUser.refreshItem(proxyItem as DataTree<OsmFeature>);
      }

      if (generation === refreshCount) osmRefreshComplete = true;
    });
  });

  async function fetchChildrenAndAddToTree(targetSlug: string): Promise<void> {
    const node = parentMap[targetSlug];
    // Abort if children are already marked as fetched
    if (node?.childrenFetched) return;

    const childrenData = await dataClient.getChildren(targetSlug);
    integrateIntoTree(childrenData);

    if (parentMap[targetSlug]) {
      parentMap[targetSlug].childrenFetched = true;
    }
  }

  $effect(() => {
    // Prevent execution during SSR / Static prerendering
    if (!browser) return;

    // Include the root ("") so we get top-level items in the sidebar
    const slugsToFetch = ["", ...segments];
    for (const s of slugsToFetch) {
      fetchChildrenAndAddToTree(s);
    }
  });

  function integrateIntoTree(elements: DataJSONRecord) {
    // We need to sort the slugs to ensure that parents are processed before children. This way, we can always find the parent in the parentMap when processing a child.
    const sortedEntries = Object.entries(elements)
      .filter(([slug, _d]) => !parentMap[slug]) // only process slugs that are not already in the parentMap: they have already been added
      .map(([childSlug, data]) => {
        const splitted = childSlug.split("/");
        const depth = splitted.length;
        const parentSlug = childSlug.slice(0, -splitted[splitted.length - 1]!.length - 1);
        return [childSlug, data, depth, parentSlug] as const;
      })
      .sort(([_ka, _va, depthA], [_kb, _vb, depthB]) => depthA - depthB);

    for (const [childSlug, data, _depth, parentSlug] of sortedEntries) {
      const parent = parentMap[parentSlug];
      if (!parent) continue;

      if (!parent.children) parent.children = {};

      parent.children[childSlug] = { feature: data };
      // We NEED to get it back from parent.children, because that gives us back the proxy, and not the raw object. This is important for reactivity.
      parentMap[childSlug] = parent.children[childSlug];
    }
  }

  const breadcrumbItems: BreadcrumbSegment[] = $derived.by(() => {
    return segments.map((slug) => ({ slug, data: parentMap[slug] }));
  });

  setCurrentNode({
    get current() {
      const d = parentMap[slug];
      if (!d) {
        console.warn(`Current node not found for slug: ${slug} in tree`, parentMap);
        return tree;
      }
      return d;
    },
  });

  setBreadcrumbs({
    get slugs() {
      return segments;
    },
    get items() {
      return breadcrumbItems;
    },
  });

  setTree({
    get current() {
      return tree;
    },
    set current(value) {
      tree = value;
    },
    fetchChildren: fetchChildrenAndAddToTree,
    integrateIntoTree,
    parentMap,
  });

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
