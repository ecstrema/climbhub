import { createContext } from "svelte";

import type { DataJSON } from "climbing-data-gen";

import type { BreadcrumbSegment, RecursiveData } from "$lib/types";
import type { FromCurrent } from "./types";

export const [getCurrentNode, setCurrentNode] = createContext<FromCurrent<DataJSON>>();
export const [getBreadcrumbs, setBreadcrumbs] = createContext<FromCurrent<BreadcrumbSegment[]>>();
export const [getTree, setTree] = createContext<FromCurrent<RecursiveData<DataJSON>>>();
