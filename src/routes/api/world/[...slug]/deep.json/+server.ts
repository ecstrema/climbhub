import { join, dirname } from "path";
import { readdir } from "fs/promises";

import { error, json } from "@sveltejs/kit";

import type { DataJSONRecord } from "$lib/types";

import type { RequestHandler } from "./$types";
import { resolve } from "$app/paths";

export const GET: RequestHandler = async ({ params, fetch }) => {
  const files: DataJSONRecord = {};

  const root = join(process.cwd(), "src/climbing_data_gen/data/world");
  const path = join(root, params.slug);

  try {
    // Get all data.json except those that are in shallow.json. That is, those in deep subdirectories, not those 1 directory deep.
    const entries = await readdir(path, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (!(entry.isFile() && entry.name === "data.json")) {
        continue;
      }
      // It should be at least two level deep.
      if (entry.parentPath === path || dirname(entry.parentPath) === path) {
        continue;
      }

      const slug = join(entry.parentPath.slice(root.length + 1)).replaceAll("\\", "/");
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

  return json(files);
};

export const prerender = true;
