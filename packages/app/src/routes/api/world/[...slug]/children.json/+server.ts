import { join } from "path";
import { readdir } from "fs/promises";

import { error } from "@sveltejs/kit";

import type { DataJSONRecord } from "$lib/types";

import type { RequestHandler } from "./$types";
import { resolve } from "$app/paths";
import { rootPath, withCache } from "../utils";

export const GET: RequestHandler = async ({ params, fetch }) => {
  const path = join(rootPath, params.slug);
  const childrenPath = join(path, "children.json");

  return withCache(childrenPath, async () => {
    const files: DataJSONRecord = {};

    // Get all children immediately children data.json
    try {
      const entries = await readdir(path, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const slug = join(params.slug, entry.name).replaceAll("\\", "/");
        const link = resolve("/api/world/[...slug]/data.json", { slug });
        const res = await fetch(link);

        if (!res.ok) {
          console.error(link, res.status, res.statusText);
        }

        files[slug] = await res.json();
      }
    } catch (err) {
      // instance of File not found error
      console.log("Error reading children.json for path:", path, err);
      if (err instanceof Error && err.message.includes("ENOENT")) {
        error(404, err.message);
      }
      throw err;
    }
    return files;
  });
};

export const prerender = true;
