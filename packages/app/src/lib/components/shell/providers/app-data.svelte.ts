import { createContext } from "svelte";

import type { BreadcrumbSegment, DataTree } from "$lib/types";
import type { FromCurrent } from "./types";
import type { ProcessedData } from "$lib/data";

export const [getCurrentNode, setCurrentNode] = createContext<FromCurrent<DataTree>>();
export const [getBreadcrumbs, setBreadcrumbs] = createContext<FromCurrent<BreadcrumbSegment[]>>();
export const [getTree, setTree] = createContext<FromCurrent<DataTree>>();
export const [getProcessedData, setProcessedData] =
  createContext<FromCurrent<ProcessedData | undefined>>();
