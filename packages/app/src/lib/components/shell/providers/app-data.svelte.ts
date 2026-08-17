import { createContext } from "svelte";

import type { BreadcrumbSegment, DataTree } from "$lib/types";
import type { FromCurrent } from "./types";

export const [getCurrentNode, setCurrentNode] = createContext<FromCurrent<DataTree>>();
export const [getBreadcrumbs, setBreadcrumbs] = createContext<FromCurrent<BreadcrumbSegment[]>>();
export const [getTree, setTree] = createContext<FromCurrent<DataTree>>();
