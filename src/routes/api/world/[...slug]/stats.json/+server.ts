import { join } from "path";
import { readdir } from "fs/promises";

import { error, json } from "@sveltejs/kit";

import type { AreaStats, DataJSON } from "$lib/types";

import type { RequestHandler } from "./$types";
import { resolve } from "$app/paths";

export const GET: RequestHandler = async ({ params, fetch }) => {
  const root = join(process.cwd(), "src/climbing_data_gen/data/world");
  const path = join(root, params.slug);

  const stats: AreaStats = {
    totalRoutes: 0,
  };

  try {
    const entries = await readdir(path, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (!(entry.isFile() && entry.name === "data.json" && entry.parentPath !== path)) {
        continue;
      }

      const slug = join(entry.parentPath.slice(root.length + 1)).replaceAll("\\", "/");
      const link = resolve("/api/world/[...slug]/data.json", { slug });
      const res = await fetch(link);

      if (!res.ok) {
        console.error(link, res.status, res.statusText);
      }

      const data: DataJSON = await res.json();

      if (data.type === "node" && data.tags && data.tags["climbing"] === "route_bottom") {
        stats.totalRoutes += 1;
      }
    }
  } catch (err) {
    if (err instanceof Error) {
      error(404, err.message);
    }
    throw err;
  }

  return json(stats);
};

export const prerender = true;
