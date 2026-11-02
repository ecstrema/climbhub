import { resolve } from "path";

/** Committed boundaries of the whole world. See the readme. */
export const DATA_DIR = resolve(import.meta.dirname, "../data");
export const OUTPUT_DIR = resolve(import.meta.dirname, "../output");
export const HIERARCHY_INDEX = resolve(OUTPUT_DIR, "hierarchy-index.json");
export const USER_AGENT = "climbhub/1.0";
