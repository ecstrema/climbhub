import { join } from "path";

import type { AreaStats } from "$lib/types";

import type { RequestHandler } from "./$types";
import { rootPath, withCache } from "../utils";
import { dataClient } from "$lib/data-client";

export const GET: RequestHandler = async ({ params, fetch }) => {
  const path = join(rootPath, params.slug);

  const res = await withCache(join(path, "stats.json"), async () => {
    const children = await dataClient.getChildren(params.slug, fetch);

    const allStats = await Promise.all(
      Object.entries(children).map(async ([childSlug, child]): Promise<AreaStats> => {
        if (child.type === "node") {
          // TODO: moulinettes only have a route_top
          if (child.tags && child.tags.climbing === "route_bottom") {
            return {
              totalRoutes: 1,
            };
          }
          if (child.tags) console.warn("ignored node with tags", child.tags);
          return {
            totalRoutes: 0,
          };
        }

        return (await dataClient.getStats(childSlug, fetch)) ?? { totalRoutes: 0 };
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

  return res;
};

export const prerender = true;
