import { join, dirname } from "path";
import { readdir } from "fs/promises";

import { error } from "@sveltejs/kit";

import type { DataJSONRecord } from "$lib/types";

import type { RequestHandler } from "./$types";
import { resolve } from "$app/paths";
import { withCache, rootPath } from "../utils";

/**
 * The deep endpoint returns all grandchildren, grandgrandchildren, etc. Every subchild that is not a direct child.
 * It is used to download all the missing data if the user wants to download an area, but has almost only the direct children.
 */
export const GET: RequestHandler = async ({ params, fetch }) => {
  const path = join(rootPath, params.slug);
  const deepPath = join(path, "deep.json");

  return withCache(deepPath, async () => {
    const files: DataJSONRecord = {};

    try {
      // Get all data.json except those that are in children.json. That is, those in deep subdirectories, not those 1 directory deep.
      const entries = await readdir(path, { withFileTypes: true, recursive: true });
      for (const entry of entries) {
        if (!(entry.isFile() && entry.name === "data.json")) {
          continue;
        }
        // It should be at least two level deep.
        if (entry.parentPath === path || dirname(entry.parentPath) === path) {
          continue;
        }

        const slug = join(entry.parentPath.slice(rootPath.length + 1)).replaceAll("\\", "/");
        const link = resolve("/api/world/[...slug]/data.json", { slug });
        const res = await fetch(link);

        if (!res.ok) {
          console.error(link, res.status, res.statusText);
        }

        files[slug] = await res.json();
      }
    } catch (err) {
      if (err instanceof Error) {
        error(404, err.message);
      }
      throw err;
    }
    return files;
  });
};

export const prerender = true;
