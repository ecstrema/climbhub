import { resolve } from "$app/paths";
import type { AreaStats } from "$lib/types";
import type { PageLoad } from "./$types";

export const load: PageLoad<{
  stats: AreaStats;
}> = async ({ params, fetch }) => {
  const res = await fetch(resolve("/api/world/[...slug]/stats.json", { slug: params.slug || "" }));
  if (!res.ok) {
    return {
      stats: {
        totalRoutes: 0,
      },
    };
  }

  return { stats: (await res.json()) as AreaStats };
};
