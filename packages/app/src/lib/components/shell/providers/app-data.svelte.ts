import { createContext, tick } from "svelte";

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
  root: DataTree = $state(undefined as unknown as DataTree);

  parentMap: Record<string, DataTree> = {};

  constructor(root: DataTree) {
    this.root = root;
    this.parentMap[""] = root;
  }

  integrateNodeIntoTree(element: DataTree, slug: string) {
    const integrateChildren = (children: Record<string, DataTree>) => {
      // integrate the children of the element into the parentMap as well
      if (element.children) {
        for (const [childSlug, childElement] of Object.entries(children)) {
          this.parentMap[childSlug] = childElement;
        }
      }
    };

    if (Object.hasOwn(this.parentMap, slug)) {
      integrateChildren(element.children || {});
      return;
    }

    const parentSlug = getParentSlug(slug);
    const parent = this.parentMap[parentSlug];
    if (!parent) {
      console.log(`Parent not found for slug ${slug}. Parent slug: ${parentSlug}`);
      return;
    }

    parent.children ??= {};
    parent.children[slug] = element;
    // Get back reactive proxy
    const reactiveNode = parent.children[slug];
    this.parentMap[slug] = reactiveNode;

    integrateChildren(reactiveNode.children || {});
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

  async fetchStats(targetSlug: string): Promise<void> {
    const stats = await dataClient.getStats(targetSlug);

    await tick();
    const node = this.parentMap[targetSlug];
    if (node && stats) {
      node.stats = stats;
    }
  }
}
