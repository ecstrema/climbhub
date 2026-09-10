import { createContext } from "svelte";

import type { BreadcrumbSegment, DataJSONRecord, DataTree } from "$lib/types";
import type { FromCurrent } from "./types";
import { dataClient } from "$lib/data-client";
import { getParentSlug } from "$lib/slug";

export const [getCurrentNode, setCurrentNode] = createContext<FromCurrent<DataTree>>();

// The following two could be classes instead
export const [getBreadcrumbs, setBreadcrumbs] = createContext<{
  slugs: string[];
  items: BreadcrumbSegment[];
}>();

export const [getTree, setTree] = createContext<AppDataTree>();

export const [getRefreshState, setRefreshState] = createContext<{
  refreshCount: number;
  osmRefreshComplete: boolean;
}>();

export class AppDataTree {
  root: DataTree = $state({
    feature: { type: "geographic", name: "World" },
  });

  parentMap: Record<string, DataTree> = {
    // svelte-ignore state_referenced_locally we can ignore this, because we should never be setting tree.
    // In fact, the only place we set it is below, in setTree().
    // If we don't add a setter in setTree, we get a svelte warning of binding to a non reactive property.
    "": this.root,
  };

  integrateNodeIntoTree(element: DataTree, slug: string) {
    if (Object.hasOwn(this.parentMap, slug)) return;

    const parentSlug = getParentSlug(slug);
    const parent = this.parentMap[parentSlug];
    if (!parent) {
      console.log(`Parent not found for slug ${slug}. Parent slug: ${parentSlug}`);
      return;
    }

    parent.children ??= {};
    parent.children[slug] = element;
    // Get back reactive proxy
    this.parentMap[slug] = parent.children[slug];
  }

  /**
   * Integrate the given elements into the tree.
   *
   * This manually finds the parent of each element, and adds it to the parent's children.
   *
   * This is a slow function, because it needs to sort the elements by depth, and then find the parent for each element. Prefer using other functions such as fetchChildren(slug: string) whenever possible, which are much faster.
   *
   * This does not set the childrenFetched flag, so use getChildren to fetch children instead.
   **/
  integrateElementsIntoTree(elements: DataJSONRecord) {
    // We need to sort the slugs to ensure that parents are processed before children. This way, we can always find the parent in the parentMap when processing a child.
    const sortedEntries = Object.entries(elements)
      .filter(([slug, _d]) => !this.parentMap[slug]) // only process slugs that are not already in the parentMap: they have already been added
      .map(([childSlug, data]) => {
        const splitted = childSlug.split("/");
        const depth = splitted.length;
        const parentSlug = childSlug.slice(0, -splitted[splitted.length - 1]!.length - 1);
        return [childSlug, data, depth, parentSlug] as const;
      })
      .sort(([_ka, _va, depthA], [_kb, _vb, depthB]) => depthA - depthB);

    for (const [childSlug, data, _depth, parentSlug] of sortedEntries) {
      const parent = this.parentMap[parentSlug];
      if (!parent) continue;

      if (!parent.children) parent.children = {};

      parent.children[childSlug] = { feature: data };
      // We NEED to get it back from parent.children, because that gives us back the proxy, and not the raw object. This is important for reactivity.
      this.parentMap[childSlug] = parent.children[childSlug];
    }
  }

  async fetchChildren(targetSlug: string): Promise<void> {
    const node = this.parentMap[targetSlug];
    // Abort if children are already marked as fetched
    if (!node || node.childrenFetched) return;

    node.children ??= {};

    const childrenData = await dataClient.getChildren(targetSlug);
    for (const [childSlug, data] of Object.entries(childrenData)) {
      if (!node.children[childSlug]) {
        // Use existing node if it was partially loaded, otherwise create a new one
        node.children[childSlug] = this.parentMap[childSlug] || { feature: data };
      }

      // Extract the newly created proxy back into the map
      this.parentMap[childSlug] = node.children[childSlug];
    }

    node.childrenFetched = true;
  }
}
