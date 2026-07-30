import { resolve } from "path";

export const CONFIG_DIR = resolve(import.meta.dirname, "../data");
export const OUTPUT_DIR = resolve(import.meta.dirname, "../output");
export const WORLD_DIR = resolve(OUTPUT_DIR, "world");
export const HIERARCHY_INDEX = resolve(OUTPUT_DIR, "hierarchy-index.json");
export const USER_AGENT = "climbhub/1.0";
