import { featureToType, getName, type ItemType } from "$lib/data/parse/data";
import { getGradeReference } from "$lib/data/parse/osm-tags";
import type { DataTree } from "$lib/types";
import type { OsmFeature } from "osm-api";
import { getStaticIdentifier, type BasicOsmType } from "@climbhub/common";
import { createContext } from "svelte";
import type { FromCurrent } from "../providers/types";

export type SortedChildren = Record<ItemType | "other", string[]>;
/** Sorts the children and gives back the ordered item slugs */
export function sortChildren(item: DataTree): SortedChildren | undefined {
  if (!item.children) return;

  if (item.feature.type === "relation" && Array.isArray(item.feature.members)) {
    const idToItem = getIdToItem(item);
    const result: SortedChildren = {
      geographic: [],
      route: [],
      area: [],
      gym: [],
      other: [],
    };

    for (const member of item.feature.members) {
      const slug = idToItem[getStaticIdentifier(member.type as BasicOsmType, member.ref)];
      if (slug) {
        const child = item.children[slug]!;
        const childType = featureToType(child.feature) ?? "other";
        result[childType].push(slug);
      }
    }
    return result;
  }

  const grouped = Object.groupBy(
    Object.entries(item.children),
    ([, child]) => featureToType(child.feature) ?? "other",
  );

  return {
    geographic: grouped.geographic?.sort(nameSort).map(([slug]) => slug) ?? [],
    route: grouped.route?.sort(routeSort).map(([slug]) => slug) ?? [],
    area: grouped.area?.sort(areaSort).map(([slug]) => slug) ?? [],
    gym: grouped.gym?.sort(nameSort).map(([slug]) => slug) ?? [],
    other: grouped.other?.sort(nameSort).map(([slug]) => slug) ?? [],
  };

  function nameSort([_aSlug, a]: [string, DataTree], [_bSlug, b]: [string, DataTree]) {
    const nameA = getName(a.feature);
    const nameB = getName(b.feature);
    return nameA && nameB ? nameA.localeCompare(nameB) : 0;
  }

  function routeSort([_aSlug, a]: [string, DataTree], [_bSlug, b]: [string, DataTree]) {
    const tagsA = (a.feature as OsmFeature).tags || {};
    const tagsB = (b.feature as OsmFeature).tags || {};
    const refA = getGradeReference(tagsA);
    const refB = getGradeReference(tagsB);
    const diff = (refB || 0) - (refA || 0);
    if (diff) return diff;
    return nameSort([_aSlug, a], [_bSlug, b]);
  }

  function areaSort([_aSlug, a]: [string, DataTree], [_bSlug, b]: [string, DataTree]) {
    const diff = (b.stats?.totalRoutes || 0) - (a.stats?.totalRoutes || 0);
    if (diff) return diff;
    return nameSort([_aSlug, a], [_bSlug, b]);
  }

  function getIdToItem(item: DataTree): Record<string, string> {
    const mapIdToItem: Record<string, string> = {};
    for (const [slug, data] of Object.entries(item.children ?? {})) {
      if (data.feature.type === "geographic") {
        console.error("Geographic folder inside of relation");
        continue;
      }
      mapIdToItem[getStaticIdentifier(data.feature.type, data.feature.id)] = slug;
    }
    return mapIdToItem;
  }
}

export type SearchFilter = (d: DataTree) => boolean;

export const [getSearchFilter, setSearchFilter] = createContext<FromCurrent<SearchFilter>>();
