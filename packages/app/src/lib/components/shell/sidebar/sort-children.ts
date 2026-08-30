import { featureToType, getName } from "$lib/data";
import { getGrade, getGradeReference, type Grade } from "$lib/osm-tags";
import type { DataTree } from "$lib/types";
import { getReference, getScaleFromId } from "@climbhub/holy-grade";
import type { OsmFeature } from "osm-api";

/** Sorts the children and gives back the ordered item slugs */
export function sortChildren(item: DataTree): string[] | undefined {
  if (!item.children) return;

  if (item.feature.type !== "relation") {
    return Object.entries(item.children)
      .sort(([_ka, va], [_kb, vb]) => {
        const typeA = featureToType(va.feature);
        const typeB = featureToType(vb.feature);
        function typeOrder(type: string | undefined) {
          switch (type) {
            case "area":
              return 0;
            case "route":
              return 1;
            case "gym":
              return 2;
            default:
              return 3;
          }
        }

        if (typeA !== typeB) {
          const orderA = typeOrder(typeA);
          const orderB = typeOrder(typeB);
          return orderA - orderB;
        }

        // we know typeA === typeB
        if (typeA === "area" || typeA === "geographic") {
          const diff = (vb.stats?.totalRoutes || 0) - (va.stats?.totalRoutes || 0);
          if (diff) return diff;
        }

        if (typeA === "route") {
          const tagsA = (va.feature as OsmFeature).tags || {};
          const tagsB = (vb.feature as OsmFeature).tags || {};

          const refA = getGradeReference(tagsA);
          const refB = getGradeReference(tagsB);

          const diff = (refB || 0) - (refA || 0);
          if (diff) return diff;
        }

        const nameA = getName(va.feature);
        const nameB = getName(vb.feature);
        if (nameA && nameB) {
          return nameA.localeCompare(nameB);
        }
        return 0;
      })
      .map(([slug]) => slug);
  }

  // If this is a relation, we want to order the children according to the order of the members in the relation
  const mapIdToItem: Record<string, string> = {};
  for (const [slug, data] of Object.entries(item.children)) {
    if (data.feature.type === "geographic") {
      console.error("Geographic folder inside of relation");
      continue;
    }
    mapIdToItem[`${data.feature.type}-${data.feature.id}`] = slug;
  }

  const ordered: string[] = [];
  for (const member of item.feature.members) {
    const i = mapIdToItem[`${member.type}-${member.ref}`];
    if (i) {
      ordered.push(i);
    }
  }
  return ordered;
}
