<script lang="ts">
  import type { BreadcrumbSegment, DataJSONRecord, DataTree } from "$lib/types";
  import type { Snippet } from "svelte";
  import { setBreadcrumbs, setCurrentNode, setTree } from "./app-data.svelte";

  const {
    children,
    slug,
    elements,
  }: {
    children: Snippet;
    slug: string | undefined;
    elements: DataJSONRecord;
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
      return { slug, data: elements[slug]! };
    });
  });

  let tree: DataTree = $state({
    feature: { type: "geographic", name: "World" },
  });

  const parentMap: Record<string, DataTree> = {
    // svelte-ignore state_referenced_locally we can ignore this, because we should never be setting tree.
    // In fact, the only place we set it is below, in setTree().
    // If we don't add a setter in setTree, we get a svelte warning of binding to a non reactive property.
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
      parent.children[slug] = { feature: data };

      // We NEED to get it back from parent.children, because that gives us back the proxy, and not the raw object. This is important for reactivity.
      parentMap[slug] = parent.children[slug];
    }
  }

  const currentNode: DataTree = $derived.by(
    () => parentMap[breadcrumbs.at(-1)?.slug ?? ""] ?? tree,
  );

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
    set current(t) {
      console.error("do not set the elements tree");
      tree = t;
    },
  });
</script>

{@render children?.()}
