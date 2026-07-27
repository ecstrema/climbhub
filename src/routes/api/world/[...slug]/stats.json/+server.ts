import { join } from "path";

import { error } from "@sveltejs/kit";

import type { AreaStats, DataJSONRecord } from "$lib/types";

import type { RequestHandler } from "./$types";
import { resolve } from "$app/paths";
import { rootPath, withCache } from "../utils";

export const GET: RequestHandler = async ({ params, fetch }) => {
  const path = join(rootPath, params.slug);

  return withCache(join(path, "stats.json"), async () => {
    const childrenRes = await fetch(
      resolve("/api/world/[...slug]/children.json", { slug: params.slug }),
    );

    if (!childrenRes.ok) {
      error(404, "Not Found");
    }

    const children: DataJSONRecord = await childrenRes.json();

    const allStats = await Promise.all(
      Object.entries(children).map(async ([childSlug, child]): Promise<AreaStats> => {
        if (child.type === "node") {
          // TODO: moulinettes only have a route_top
          if (child.tags && child.tags["climbing"] === "route_bottom") {
            return {
              totalRoutes: 1,
            };
          }
          if (child.tags) console.warn("ignored node with tags", child.tags);
          return {
            totalRoutes: 0,
          };
        }
        const res = await fetch(resolve("/api/world/[...slug]/stats.json", { slug: childSlug }));
        if (!res.ok) {
          console.error("Could not get stats for child", childSlug);
          return {
            totalRoutes: 0,
          };
        }
        return await res.json();
      }),
    );

    return allStats.reduce(
      (acc, current) => {
        for (const key of Object.keys(acc) as (keyof typeof acc)[]) {
          acc[key] += current[key];
        }
        return acc;
      },
      { totalRoutes: 0 },
    );
  });
};
