import { createContext } from "svelte";

import type { BreadcrumbSegment, DataJSONRecord, DataTree } from "$lib/types";
import type { FromCurrent } from "./types";

export const [getCurrentNode, setCurrentNode] = createContext<FromCurrent<DataTree>>();

// The following two could be classes instead
export const [getBreadcrumbs, setBreadcrumbs] = createContext<{
  slugs: string[];
  items: BreadcrumbSegment[];
}>();
export const [getTree, setTree] = createContext<
  FromCurrent<DataTree> & {
    fetchChildren: (slug: string) => void;
    integrateIntoTree: (elements: DataJSONRecord) => void;
    /** Non reactive map of slugs to reactive DataTree nodes */
    parentMap: Record<string, DataTree>;
  }
>();

export const [getRefreshState, setRefreshState] = createContext<{
  refreshCount: number;
  osmRefreshComplete: boolean;
}>();
