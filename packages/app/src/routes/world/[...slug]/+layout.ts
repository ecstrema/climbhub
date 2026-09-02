import { resolve } from "$app/paths";
import type { AreaStats, DataJSONRecord, DataTree } from "$lib/types";
import type { DataJSON } from "@climbhub/climbing-data-gen";
import type { LayoutLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { dataTreeFromJsonRecord } from "$lib/data";

export interface LayoutLoadType {
  currentItem: DataTree;
  parents: DataJSONRecord;
  // We can't return this here as during ssr, the promise would be awaited
  // parentChildren: Promise<DataJSONRecord>;
}

export const load: LayoutLoad<LayoutLoadType> = async ({ params, fetch }) => {
  const slugs = getSlugs(params.slug || "");

  return {
    currentItem: {
      feature: await fetchData(params.slug),
      children: dataTreeFromJsonRecord(await fetchChildren(params.slug)),
      stats: await fetchStats(params.slug),
    },
    parents: await getParents(slugs),
  };

  async function getParents(breadcrumbSlugs: string[]): Promise<DataJSONRecord> {
    const parents: DataJSONRecord = {};
    for (const slug of breadcrumbSlugs) {
      parents[slug] = await fetchData(slug);
    }
    return parents;
  }

  /** Does not include the current slug */
  function getSlugs(slug: string): string[] {
    const slugs = [];
    let acc: string = "";
    for (const char of slug) {
      if (char === "/") {
        slugs.push(acc);
      }
      acc += char;
    }
    return slugs;
  }

  async function fetchChildren(slug: string): Promise<DataJSONRecord> {
    const res = await fetch(resolve("/api/world/[...slug]/children.json", { slug }));
    if (!res.ok) {
      console.log(`Failed to fetch children for slug: ${slug}`, res.status, res.statusText);
      return {};
    }
    return res.json() as Promise<DataJSONRecord>;
  }

  async function fetchData(slug: string): Promise<DataJSON> {
    const res = await fetch(resolve("/api/world/[...slug]/data.json", { slug }));
    if (!res.ok) {
      return error(res.status, `Failed to fetch data for slug: ${slug}`);
    }
    return res.json() as Promise<DataJSON>;
  }

  async function fetchStats(slug: string): Promise<AreaStats | undefined> {
    const res = await fetch(resolve("/api/world/[...slug]/stats.json", { slug }));
    if (!res.ok) {
      console.log(`Failed to fetch stats for slug: ${slug}`, res.status, res.statusText);
      return undefined;
    }
    return res.json() as Promise<AreaStats>;
  }
};
