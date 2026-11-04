import type { AreaStats, DataJSONRecord, DataTree } from "#lib/types.js";
import type { DataJSON } from "@climbhub/climbing-data-gen";
import type { LayoutLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { dataClient } from "#lib/data/network/data-client.js";
import { dataTreeFromJsonRecord } from "#lib/data/parse/data.js";
import { getParentSlugs } from "#lib/helpers/slug.js";
import { osmIndexFile, parseOsmPathSegment } from "@climbhub/common";
import { resolve } from "$app/paths";
import { building } from "$app/env";

export interface LayoutLoadType {
  slug: string;
  currentItem: DataTree;
  additionalData: DataJSONRecord;
  // We can't return this here as during ssr, the promise would be awaited, and we would create big html files.
  // So we fetch it in the component instead.
  // parentChildren: Promise<DataJSONRecord>;
}

export const load: LayoutLoad<LayoutLoadType> = async ({ params, fetch, url }) => {
  const pathSlug = params.slug ?? "";
  const id = building ? null : url.searchParams.get("id");
  const slug = (await getSlugFromId(id)) ?? pathSlug;
  const slugs = getParentSlugs(slug);

  // Start all fetching at the same time
  const promises = {
    self: fetchData(slug),
    children: fetchChildren(slug),
    stats: fetchStats(slug),
    parents: getParents(slugs),
  };

  const self = await promises.self;
  if (!self) {
    return error(404, `Could not find item ${slug}`);
  }

  const result: LayoutLoadType = {
    slug,
    currentItem: {
      feature: self,
    },
    additionalData: await promises.parents,
  };

  const stats = await promises.stats;
  if (stats) result.currentItem.stats = stats;

  const children = await promises.children;
  if (children) {
    result.currentItem.children = dataTreeFromJsonRecord(children);
    result.currentItem.childrenFetched = true;
  }

  return result;

  async function getParents(breadcrumbSlugs: string[]): Promise<DataJSONRecord> {
    const parents: DataJSONRecord = {};
    for (const slug of breadcrumbSlugs) {
      const parent = await fetchData(slug);
      if (parent) parents[slug] = parent;
    }
    return parents;
  }

  async function fetchChildren(slug: string): Promise<DataJSONRecord | undefined> {
    try {
      // Pass SvelteKit's fetch to the dataClient for SSR compatibility
      return await dataClient.getChildren(slug, fetch);
    } catch (e) {
      console.log(`Failed to fetch children for slug: ${slug}`, e);
      return undefined;
    }
  }

  async function fetchData(slug: string): Promise<DataJSON | undefined> {
    try {
      // Pass SvelteKit's fetch to the dataClient for SSR compatibility
      return await dataClient.getNode(slug, fetch);
    } catch {
      console.warn(`Failed to fetch data for slug: ${slug}`);
      return undefined;
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

  async function getSlugFromId(id: string | null): Promise<string | undefined> {
    if (!id) return undefined;
    const localSlug = dataClient.getLocalSlugByOsmId(id);
    if (localSlug) return localSlug;

    const osm = parseOsmPathSegment(id);
    if (!osm) return undefined;
    const base = resolve("/").replace(/\/$/, "");
    const response = await fetch(`${base}/api/${osmIndexFile(osm.type, osm.id)}`);
    if (!response.ok) return undefined;
    const index: Record<string, string> = await response.json();
    return index[osm.id];
  }
};
