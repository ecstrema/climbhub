import { join } from "path";

import type { AreaStats } from "$lib/types";

import type { RequestHandler } from "./$types";
import { rootPath, withCache, withErrorHandler } from "../utils";
import { dataClient } from "$lib/data/network/data-client";
import { featureToType } from "$lib/data/parse/data";

export const GET: RequestHandler = async ({ params, fetch }) => {
  const path = join(rootPath, params.slug);

  return withErrorHandler(
    async () =>
      await withCache(join(path, "stats.json"), async () => {
        const children = await dataClient.getChildren(params.slug, fetch);

        const allStats = await Promise.all(
          Object.entries(children || {}).map(async ([childSlug, child]): Promise<AreaStats> => {
            const t = featureToType(child);
            if (t === "route") {
              return {
                totalRoutes: 1,
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
      }),
  );
};

export const prerender = true;
