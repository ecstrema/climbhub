import type { AreaStats, DataJSONRecord, DataTree } from "$lib/types";
import type { DataJSON } from "@climbhub/climbing-data-gen";
import type { LayoutLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { dataTreeFromJsonRecord } from "$lib/data";
import { dataClient } from "$lib/data-client";
import { getParentSlugs } from "$lib/slug";

export interface LayoutLoadType {
  currentItem: DataTree;
  parents: DataJSONRecord;
  // We can't return this here as during ssr, the promise would be awaited, and we would create big html files.
  // So we fetch it in the component instead.
  // parentChildren: Promise<DataJSONRecord>;
}

export const load: LayoutLoad<LayoutLoadType> = async ({ params, fetch }) => {
  const slugs = getParentSlugs(params.slug || "");

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

  async function fetchChildren(slug: string): Promise<DataJSONRecord> {
    try {
      // Pass SvelteKit's fetch to the dataClient for SSR compatibility
      return await dataClient.getChildren(slug, fetch);
    } catch (e) {
      console.log(`Failed to fetch children for slug: ${slug}`, e);
      return {};
    }
  }

  async function fetchData(slug: string): Promise<DataJSON> {
    try {
      // Pass SvelteKit's fetch to the dataClient for SSR compatibility
      return (await dataClient.getNode(slug, fetch)) as DataJSON;
    } catch {
      error(404, `Failed to fetch data for slug: ${slug}`);
    }
  }

  async function fetchStats(slug: string): Promise<AreaStats | undefined> {
    try {
      // Pass SvelteKit's fetch to the dataClient for SSR compatibility
      return await dataClient.getStats(slug, fetch);
    } catch {
      console.warn(`Failed to fetch stats for slug: ${slug}`);
      return undefined;
    }
  }
};
