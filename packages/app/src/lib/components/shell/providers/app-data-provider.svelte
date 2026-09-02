<script lang="ts">
  import type { BreadcrumbSegment, DataJSONRecord, DataTree } from "$lib/types";
  import { type Snippet } from "svelte";
  import { setBreadcrumbs, setCurrentNode, setTree } from "./app-data.svelte";
  import { browser } from "$app/env";
  import { resolve } from "$app/paths";

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

  // svelte-ignore state_referenced_locally
  const currentItemState = $state(currentItem);

  $effect(addCurrentItemToParentMap);
  addCurrentItemToParentMap();

  function addCurrentItemToParentMap() {
    if (!currentItemState || parentMap[slug]) return;
    parentMap[slug] = currentItemState;
  }

  function fetchChildrenAndAddToTree(slug: string): Promise<DataJSONRecord> {
    return fetch(resolve("/api/world/[...slug]/children.json", { slug })).then(async (res) => {
      if (!res.ok) return {};
      const data = (await res.json()) as DataJSONRecord;
      integrateIntoTree(data);
      return data;
    });
  }

  $effect(() => {
    // Prevent execution during SSR / Static prerendering
    if (!browser) return;

    // Include the root ("") so we get top-level items in the sidebar
    const slugsToFetch = ["", ...segments];

    for (const s of slugsToFetch) {
      if (!parentMap[s]?.children) {
        fetchChildrenAndAddToTree(s);
      }
    }
  });

  function integrateIntoTree(elements: DataJSONRecord) {
    // We need to sort the slugs to ensure that parents are processed before children. This way, we can always find the parent in the parentMap when processing a child.
    const sortedEntries = Object.entries(elements)
      .filter(([slug, _d]) => !parentMap[slug]) // only process slugs that are not already in the parentMap: they have already been added
      .map(([slug, data]) => {
        const splitted = slug.split("/");
        const depth = splitted.length;
        const parentSlug = slug.slice(0, -splitted[splitted.length - 1]!.length - 1);
        return [slug, data, depth, parentSlug] as const;
      })
      .sort(([_ka, _va, depthA], [_kb, _vb, depthB]) => depthA - depthB);

    for (const [slug, data, _depth, parentSlug] of sortedEntries) {
      // get the parent slug by removing the last segment of the current slug
      const parent = parentMap[parentSlug];
      if (!parent) {
        console.warn(`Parent not found for slug: ${slug}`);
        continue;
      }

      if (!parent.children) {
        parent.children = {};
      }
      parent.children[slug] = { feature: data };

      // We NEED to get it back from parent.children, because that gives us back the proxy, and not the raw object. This is important for reactivity.
      parentMap[slug] = parent.children[slug];
    }
  }

  const breadcrumbItems: BreadcrumbSegment[] = $derived.by(() => {
    return segments.map((slug) => {
      return { slug, data: parentMap[slug] };
    });
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
</script>

{@render children?.()}
