import { createContext } from "svelte";
import type { AppDataTree } from "./app-data-tree.svelte";
import { dataClient } from "./network/data-client";
import type { BreadcrumbSegment, DataTree } from "$lib/types";
import type { FromCurrent } from "@/shell/providers/types";
import { UndoManager } from "./undo/undo-stack";
import {
  UndoableAreaCreate,
  UndoableFeatureSet,
  UndoableRouteCreate,
  UndoableTagChange,
  UndoableTagDelete,
} from "./undo/actions";
import { OsmUser } from "./network/osm.svelte";
import type { OsmFeature } from "osm-api";

export interface Breadcrumbs {
  slugs: string[];
  items: BreadcrumbSegment[];
}

export class AppState {
  tree: AppDataTree;
  breadcrumbs: Breadcrumbs;
  currentNode: FromCurrent<DataTree>;

  osmUser = new OsmUser();

  undoStack = new UndoManager();

  constructor(tree: AppDataTree, breadcrumbs: Breadcrumbs, currentNode: FromCurrent<DataTree>) {
    this.tree = tree;
    this.breadcrumbs = breadcrumbs;
    this.currentNode = currentNode;
  }

  async fetchStats(targetSlug: string): Promise<void> {
    const node = this.tree.getReactiveNode(targetSlug);
    if (node) {
      if (node.stats) return;

      const stats = await dataClient.getStats(targetSlug);
      if (stats) node.stats = stats;
    }
  }

  async fetchChildren(targetSlug: string): Promise<void> {
    const node = this.tree.getReactiveNode(targetSlug);
    // Abort if children are already marked as fetched
    if (!node || node.childrenFetched) return;

    const childrenData = await dataClient.getChildren(targetSlug);
    if (!childrenData) return;

    node.children ??= {};
    for (const [childSlug, data] of Object.entries(childrenData)) {
      if (!node.children[childSlug]) {
        const reactiveChild = this.tree.getReactiveNode(childSlug);
        // If the node was partially loaded (only some children, not all), then the child might already be present in the parent.
        // We then don't need to create a new child, we reuse the existing one.
        // In the other case, we create it and add it to node.children. When we get it back from node.children, it is reactive.
        if (reactiveChild) {
          node.children[childSlug] = reactiveChild;
        } else {
          node.children[childSlug] = { feature: data };
          this.tree.setReactiveNode(childSlug, node.children[childSlug]);
        }
      }
    }

    node.childrenFetched = true;
  }

  /**
   * Applies {@link UndoableTagChange}
   *
   * Set the value to `undefined` to remove the tag, or use {@link deleteTag}
   */
  setTag(targetSlug: string, tagKey: OsmApi.Keys["keys"], newValue: string | undefined) {
    const node = this.tree.getReactiveNode(targetSlug);
    const feature = node?.feature;
    if (!feature || feature.type === "geographic") return;

    this.undoStack.do(new UndoableTagChange(this.osmUser, feature, targetSlug, tagKey, newValue));
  }

  /** Applies {@link UndoableTagDelete} to remove the tag completely */
  deleteTag(targetSlug: string, tagKey: OsmApi.Keys["keys"]) {
    const node = this.tree.getReactiveNode(targetSlug);
    const feature = node?.feature;
    if (!feature || feature.type === "geographic") return;

    this.undoStack.do(new UndoableTagDelete(this.osmUser, feature, targetSlug, tagKey));
  }

  /**
   * Applies {@link UndoableRouteCreate} to create a new route in the parent feature.
   */
  createRoute(parent: DataTree, parentSlug: string) {
    this.undoStack.do(new UndoableRouteCreate(this.osmUser, parent, parentSlug));
  }

  /** Applies {@link UndoableAreaCreate} to create a new area in the parent feature. */
  createArea(parent: DataTree, parentSlug: string) {
    this.undoStack.do(new UndoableAreaCreate(this.osmUser, parent, parentSlug));
  }

  /** Reset a feature to before it was modified by the user */
  resetFeature(targetSlug: string) {
    const node = this.tree.getReactiveNode(targetSlug);
    const feature = node?.feature;
    if (!feature || feature.type === "geographic") return;

    this.undoStack.do(
      new UndoableFeatureSet(this.osmUser, node as DataTree<OsmFeature>, targetSlug, undefined),
    );
  }
}

export const [getAppState, setAppState] = createContext<AppState>();
