import { join } from "path";
import { readdir } from "fs/promises";

import type { DataJSONRecord } from "$lib/types";

import type { RequestHandler } from "./$types";
import { rootPath, withCache, withErrorHandler } from "../utils";
import { dataClient } from "$lib/data-client";

export const GET: RequestHandler = async ({ params, fetch }) => {
  const path = join(rootPath, params.slug);
  const childrenPath = join(path, "children.json");

  return withErrorHandler(() =>
    withCache(childrenPath, async () => {
      const files: DataJSONRecord = {};

      // Get all children immediately children data.json
      const entries = await readdir(path, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const slug = join(params.slug, entry.name).replaceAll("\\", "/");
        const node = await dataClient.getNode(slug, fetch);
        if (node) files[slug] = node;
      }
      return files;
    }),
  );
};

export const prerender = true;
