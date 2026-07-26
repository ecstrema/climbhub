import { join } from "path";
import { readdir } from "fs/promises";

import { error, json } from "@sveltejs/kit";

import type { DataJSONRecord } from "$lib/types";

import type { RequestHandler } from "./$types";
import { resolve } from "$app/paths";

export const GET: RequestHandler = async ({ params, fetch }) => {
  const files: DataJSONRecord = {};

  const path = join(process.cwd(), "src/climbing_data_gen/data/world", params.slug);

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
    if (err instanceof Error) {
      error(404, err.message);
    }
    throw err;
  }

  return json(files);
};
