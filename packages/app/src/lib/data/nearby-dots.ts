import { resolve } from "$app/paths";
import { getParentSlug } from "#lib/helpers/slug.js";
import { getCoordinates, getGrade } from "#lib/data/parse/osm-tags.js";
import type { DataTree } from "#lib/types.js";

const GROUP_COLOR = "#2563eb";
const NEIGHBOUR_COLOR = "#f97316";
const LEVELS_UP = 4;

/**
 * Everything loaded under the ancestor 4 levels above `slug`, except `slug` itself: the places of
 * the same group (siblings and children) in blue, the others in orange.
 */
export function getNearbyDots(getNode: (slug: string) => DataTree | undefined, slug: string) {
  let ancestor = slug;
  for (let i = 0; i < LEVELS_UP; i++) {
    const parent = getParentSlug(ancestor);
    if (!parent) break;
    ancestor = parent;
  }
  const parentSlug = getParentSlug(slug);
  const dots: { slug: string; lat: number; lon: number; label: string; color: string; href: string }[] = [];

  const visit = (node: DataTree | undefined) => {
    for (const [childSlug, child] of Object.entries(node?.children ?? {})) {
      if (childSlug !== slug && child.feature.type !== "geographic") {
        const position = getCoordinates(child.feature);
        if (position) {
          const grade = child.feature.tags ? getGrade(child.feature.tags)?.v.v : undefined;
          const name = child.feature.tags?.name ?? "Unnamed";
          const parent = getParentSlug(childSlug);
          dots.push({
            ...position,
            slug: childSlug,
            label: grade ? `${grade} \u00b7 ${name}` : name,
            color: parent === parentSlug || parent === slug ? GROUP_COLOR : NEIGHBOUR_COLOR,
            href: resolve("/world/[...slug]", { slug: childSlug }),
          });
        }
      }
      visit(child);
    }
  };
  visit(getNode(ancestor));
  return dots;
}
