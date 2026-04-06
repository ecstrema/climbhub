import { error } from "@sveltejs/kit";
import type { TreeNode } from "$lib/types";
import { findNodeBySlug } from "$lib/data";
import type { PageServerLoad } from "./$types";

type RoutePageProps = {
  currentNode: TreeNode;
}

export const load: PageServerLoad = async ({ params }): Promise<RoutePageProps> => {

  const node = findNodeBySlug(params.slug);

  if (!node) {
    throw error(404, "Route not found");
  }

  return {
    currentNode: node,
  };
};
