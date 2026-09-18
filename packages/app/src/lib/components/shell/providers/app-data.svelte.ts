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

  /** Non-reactive map of slugs to their reactive DataTree */
  parentMap: Record<string, DataTree> = {};

  constructor(root: DataTree) {
    this.root = root;
    this.parentMap[""] = this.root;
  }

  /**
   * Add an existing DataTree node into the tree.
   *
   * To prevent recomputing the parent slug, it can be passed as the third argument.
   */
  integrateNodeIntoTree(element: DataTree, slug: string, parentSlug?: string) {
    const integrateChildren = (children: Record<string, DataTree>, parentNode: DataTree) => {
      if (!children || Object.keys(children).length === 0) return;
      parentNode.children ??= {};

      for (const [childSlug, childElement] of Object.entries(children)) {
        parentNode.children[childSlug] = this.parentMap[childSlug] || childElement;
        this.parentMap[childSlug] = parentNode.children[childSlug];
      }
    };

    const integrateSelf = (element: DataTree, slug: string, parentSlug?: string) => {
      const actualParentSlug = parentSlug ?? getParentSlug(slug);
      // This is root, it has no parent
      if (actualParentSlug === undefined) {
        console.log(`Parent slug not found for ${slug}. Parent slug: ${actualParentSlug}`);
        return this.parentMap[""]!;
      }

      const parent = this.parentMap[actualParentSlug];
      if (!parent) {
        console.log(`Parent not found for slug ${slug}. Parent slug: ${actualParentSlug}`);
        return this.parentMap[""]!;
      }

      parent.children ??= {};
      parent.children[slug] = element;
      // Get back reactive proxy
      const reactiveSelf = parent.children[slug];
      this.parentMap[slug] = reactiveSelf;

      return reactiveSelf;
    };

    if (Object.hasOwn(this.parentMap, slug)) {
      // Fetch the existing proxy from the map
      const existingNode = this.parentMap[slug]!;
      integrateChildren(element.children || {}, existingNode);
      return;
    }

    const reactiveNode = integrateSelf(element, slug, parentSlug);
    integrateChildren(reactiveNode.children || {}, reactiveNode);
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

    const childrenData = await dataClient.getChildren(targetSlug);
    if (!childrenData) return;

    node.children ??= {};
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
