<script lang="ts">
  import type { BreadcrumbSegment, RecursiveData } from "$lib/types";
  import type { DataJSON } from "climbing-data-gen";
  import type { Snippet } from "svelte";
  import { setBreadcrumbs, setCurrentNode, setTree } from "./app-data.svelte";

  const {
    children,
    slug,
    elements,
  }: {
    children: Snippet;
    slug: string | undefined;
    elements: Record<string, DataJSON>;
  } = $props();

  const segments: string[] = $derived.by(() => {
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
      return { slug, data: elements[slug] };
    });
  });

  const tree: RecursiveData<DataJSON> = $state({
    own: { type: "geographic", name: "World" },
  });

  const parentMap: Record<string, RecursiveData<DataJSON>> = {
    "": tree,
  };

  integrateIntoTree();
  $effect(integrateIntoTree);

  function integrateIntoTree() {
    if (!elements) {
      return;
    }
    // We need to sort the slugs to ensure that parents are processed before children. This way, we can always find the parent in the parentMap when processing a child.
    const sortedEntries = Object.entries(elements)
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

      if (!parent.children) {
        parent.children = {};
      }
      parent.children[slug] = { own: data };

      // We NEED to get it back from parent.children, because that gives us back the proxy, and not the raw object. This is important for reactivity.
      parentMap[slug] = parent.children[slug];
    }
  }

  const currentNode: DataJSON = $derived.by(() => breadcrumbs.at(-1)?.data ?? tree.own);

  setCurrentNode({
    get current() {
      return currentNode;
    },
  });
  setBreadcrumbs({
    get current() {
      return breadcrumbs;
    },
  });
  setTree({
    get current() {
      return tree;
    },
  });
</script>

{@render children?.()}
