import { resolve } from "$app/paths";
import type { BreadcrumbSegment, DataJSON, DataJSONRecord, RecursiveData } from "$lib/types";
import { error } from "@sveltejs/kit";
import type { LayoutLoad } from "./$types";
import { recursiveDataJSONFromRecord } from "$lib/data";

export const load: LayoutLoad<{
  tree: RecursiveData<DataJSON>;
  breadcrumbs: BreadcrumbSegment[];
  elementData: DataJSON;
}> = async ({ params, fetch }) => {
  const res = await fetch(resolve("/api/world/[...slug]/data.json", { slug: "" }));
  if (!res.ok) {
    error(500, "Internal error");
  }

  const rootData = await res.json();
  const tree: RecursiveData<DataJSON> = {
    own: rootData,
  };
  const rootChildren = await getChildren("");
  if (rootChildren) {
    tree.children = rootChildren;
  }
  const breadcrumbs: BreadcrumbSegment[] = [];

  const slug = params.slug;
  if (!slug) {
    return {
      tree,
      breadcrumbs,
      elementData: rootData,
    };
  }

  let acc: string[] = [];
  const segments = slug.split("/").map((segment) => {
    acc.push(segment);
    return acc.join("/");
  });
  let current = tree;
  for (const segment of segments) {
    if (segment && current.children) {
      current = current.children[segment];
      if (!current) {
        error(500, "Internal error");
      }
    }

    const children = await getChildren(segment);
    if (!children) {
      continue;
    }

    current.children = children;

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

  async function getChildren(slug: string) {
    const link = resolve("/api/world/[...slug]/children.json", { slug });
    const res = await fetch(link);

    if (!res.ok) {
      console.error(link, res.status, res.statusText);
      return;
    }

    const data: DataJSONRecord = await res.json();
    return recursiveDataJSONFromRecord(data);
  }
};
