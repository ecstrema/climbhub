import { error } from "@sveltejs/kit";
import type { TreeNode } from "$lib/types";
import type { PageServerLoad } from "./$types";
import { findNodeBySlug } from "$lib/data";

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
