import { resolve } from "$app/paths";
import type { BreadcrumbSegment, DataJSONRecord } from "$lib/types";
import { error } from "@sveltejs/kit";
import type { LayoutLoad } from "./$types";
import { getName } from "$lib/data";

export const load: LayoutLoad = async ({ params, fetch }) => {
  const slug = params.slug;
  if (!slug) {
    return [];
  }

  let acc: string[] = [];
  const segments = slug.split("/").map((segment) => {
    acc.push(segment);
    return acc.join("/");
  });

  const childrenRecords: DataJSONRecord[] = [];
  for (const segment of [
    "", // add the world/ segment
    ...segments,
  ]) {
    const res = await fetch(resolve("/api/world/[...slug]/shallow.json", { slug: segment }));

    if (!res.ok) {
      console.error(res.status, res.statusText);
      continue;
    }

    childrenRecords.push(await res.json());
  }

  // children will include the next breadcrumb segment
  const breadcrumbs: BreadcrumbSegment[] = segments.map((segment, i) => {
    const el = childrenRecords[i][segment];
    if (!el) {
      return {
        link: resolve("/world"),
        name: "Not found",
      };
    }
    return {
      name: getName(el) || "No name",
      link: resolve("/world/[...slug]", { slug: segment }),
    };
  });

  const elementData = breadcrumbs.at(-1);

  if (!elementData) {
    error(500, "Internal error");
  }

  return {
    childrenRecords,
    breadcrumbs,
    elementData,
  };
};
