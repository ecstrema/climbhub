import { featureToType, getName, type ItemType } from "#lib/data/parse/data.js";
import { getGradeReference } from "#lib/data/parse/osm-tags.js";
import type { DataTree } from "#lib/types.js";
import type { OsmFeature } from "osm-api";
import { getStaticIdentifier, type BasicOsmType } from "@climbhub/common";
import { createContext } from "svelte";
import { SvelteMap } from "svelte/reactivity";
import type { FromCurrent } from "../providers/types";

export type SortedChildren = Record<ItemType | "other", string[]>;
export type ReorderableType = "route" | "area";

const ORDER_STORAGE_KEY = "climbhub:sidebar-orders";
const orderOverrides = new SvelteMap<string, Partial<Record<ReorderableType, string[]>>>();
let draggedChild: { parentSlug: string; type: ReorderableType; slug: string } | undefined;

export function restoreSidebarOrders() {
  try {
    const stored = JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY) ?? "{}");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return;
    for (const [parentSlug, orders] of Object.entries(stored)) {
      if (!orders || typeof orders !== "object" || Array.isArray(orders)) continue;
      const validOrders: Partial<Record<ReorderableType, string[]>> = {};
      for (const type of ["route", "area"] as const) {
        const order = (orders as Record<string, unknown>)[type];
        if (Array.isArray(order) && order.every((slug) => typeof slug === "string")) {
          validOrders[type] = order;
        }
      }
      orderOverrides.set(parentSlug, validOrders);
    }
  } catch {
    // Unreadable settings are ignored.
  }
}

export function getSidebarChildren(item: DataTree, parentSlug: string): SortedChildren | undefined {
  const children = sortChildren(item);
  if (!children) return;
  const overrides = orderOverrides.get(parentSlug);
  return {
    ...children,
    route: applyOrder(children.route, overrides?.route),
    area: applyOrder(children.area, overrides?.area),
  };
}

export function startSidebarDrag(parentSlug: string, type: ReorderableType, slug: string) {
  draggedChild = { parentSlug, type, slug };
}

export function canDropSidebarChild(parentSlug: string, type: ReorderableType, slug: string): boolean {
  return !!draggedChild &&
    draggedChild.parentSlug === parentSlug &&
    draggedChild.type === type &&
    draggedChild.slug !== slug;
}

export function dropSidebarChild(parent: DataTree, parentSlug: string, type: ReorderableType, targetSlug: string) {
  if (!canDropSidebarChild(parentSlug, type, targetSlug)) return;
  const ordered = getSidebarChildren(parent, parentSlug)?.[type];
  if (!ordered) return;

  const next = [...ordered];
  const sourceIndex = next.indexOf(draggedChild!.slug);
  const targetIndex = next.indexOf(targetSlug);
  if (sourceIndex === -1 || targetIndex === -1) return;
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(sourceIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, moved!);

  orderOverrides.set(parentSlug, { ...orderOverrides.get(parentSlug), [type]: next });
  try {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(Object.fromEntries(orderOverrides)));
  } catch {
    // The in-memory order still works when storage is unavailable.
  }
}

export function endSidebarDrag() {
  draggedChild = undefined;
}

function applyOrder(children: string[], order: string[] | undefined): string[] {
  if (!order?.length) return children;
  const available = new Set(children);
  return [...order.filter((slug) => available.has(slug)), ...children.filter((slug) => !order.includes(slug))];
}

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

    const seen = new Set<string>();
    for (const member of item.feature.members) {
      const slug = idToItem[getStaticIdentifier(member.type as BasicOsmType, member.ref)];
      if (slug && !seen.has(slug)) {
        seen.add(slug);
        const child = item.children[slug]!;
        const childType = featureToType(child.feature) ?? "other";
        result[childType].push(slug);
      }
    }
    return result;
  }

  const grouped = Object.groupBy(Object.entries(item.children), ([, child]) => featureToType(child.feature) ?? "other");

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

export interface SearchFilter {
  /** Whether the node is shown in the tree */
  matches: (slug: string, d: DataTree) => boolean;
  /** Whether the node holds a match, so it is opened to show it */
  shouldExpand: (slug: string) => boolean;
  /** Increments each time the user asks to collapse the whole tree */
  collapseVersion: number;
}

export const [getSearchFilter, setSearchFilter] = createContext<FromCurrent<SearchFilter>>();
