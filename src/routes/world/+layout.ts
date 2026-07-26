import { resolve } from "$app/paths";
import type { BreadcrumbSegment, DataJSON, DataJSONRecord, RecursiveData } from "$lib/types";
import { error } from "@sveltejs/kit";
import type { LayoutLoad } from "./$types";
import { recursiveDataJSONFromRecord } from "$lib/data";

export const load: LayoutLoad = async ({ params, fetch }) => {
  const slug = params.slug;
  if (!slug) {
    return [];
  }

  let acc: string[] = [];
  const segments = [
    "",
    ...slug.split("/").map((segment) => {
      acc.push(segment);
      return acc.join("/");
    }),
  ];

  const res = await fetch(resolve("/api/world/[...slug]/data.json", { slug: "" }));
  if (!res.ok) {
    error(500, "Internal error");
  }

  const tree: RecursiveData<DataJSON> = {
    own: await res.json(),
  };
  const breadcrumbs: BreadcrumbSegment[] = [];
  let current = tree;
  for (const segment of segments) {
    if (segment && current.children) {
      current = current.children[segment];
      if (!current) {
        error(500, "Internal error");
      }
    }

    const link = resolve("/api/world/[...slug]/shallow.json", { slug: segment });
    const res = await fetch(link);

    if (!res.ok) {
      console.error(link, res.status, res.statusText);
      continue;
    }

    const data: DataJSONRecord = await res.json();
    current.children = recursiveDataJSONFromRecord(data);

    breadcrumbs.push({
      data: current.own,
      slug: segment,
    });
  }

  const elementData: DataJSON = breadcrumbs.at(-1)!.data;

  if (!elementData) {
    error(500, "Internal error");
  }

  return {
    tree,
    breadcrumbs,
    elementData,
  };
};
