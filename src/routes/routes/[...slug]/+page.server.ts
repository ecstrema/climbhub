import { error } from "@sveltejs/kit";
import { type as arktype } from "arktype";
import { AreaFrontmatter, RouteFrontmatter, type RouteNode, type TreeNode } from "$lib/types";
import type { PageServerLoad } from "./$types";

type RoutePageProps = {
  html: string;
  treeNode: any; // This will be either a RouteNode or an AreaNode, but we can determine that in the component based on the "type" property.
  breadcrumbs: { name: string; link: string }[];
  routesInArea: RouteNode[]; // Only populated if this page is an Area
}

export const load: PageServerLoad = async ({ params }): Promise<RoutePageProps> => {
  // Grab the processed modules
  // Note: No need for manual parsing; the plugin handles it.
  const modules = import.meta.glob("/src/data/routes/**/*.md", {
    eager: true,
  }) as Record<string, { html: string; frontmatter: Record<string, unknown> }>;

  const routePath = `/src/data/routes/${params.slug}.md`;
  const indexPath = `/src/data/routes/${params.slug}/index.md`;

  let module = modules[routePath];
  let type: "route" | "area" = "route";

  // Construct the path for the breadcrumbs. Recursively go through the parent areas until we reach the root.
  const slugParts = params.slug.split("/");
  const breadcrumbs = [];
  for (let i = 0; i < slugParts.length; i++) {
    const breadcrumbSlug = slugParts.slice(0, i + 1).join("/");
    breadcrumbs.push({
      name: slugParts[i].replaceAll("_", " "),
      link: `/routes/${breadcrumbSlug}`,
    });
  }

  // Determine if it's a Route, an Area (index.md), or just a Folder
  if (!module) {
    if (modules[indexPath]) {
      module = modules[indexPath];
      type = "area";
    } else {
      // Check if it's a folder that exists but has no index.md
      // We verify if any known markdown file exists inside this path
      const folderExists = Object.keys(modules).some((key) =>
        key.startsWith(`/src/data/routes/${params.slug}/`),
      );

      if (folderExists) {
        module = {
          html: "",
          frontmatter: {},
        }
      } else {
        throw error(404, `Route or Area ${params.slug} not found`);
      }
    }
  }

  // Validate with Arktype
  const { html, frontmatter } = module;
  const frontmatterData =
    type === "area" ? AreaFrontmatter(frontmatter) : RouteFrontmatter(frontmatter);

  // Construct the node
  const treeNode: TreeNode = {
    type,
    name: params.slug.split("/").pop()?.replaceAll("_", " ") || "",
    link: `/routes/${params.slug}`,
  };

  if (frontmatterData instanceof arktype.errors) {
    treeNode.errors = frontmatterData;
  } else {
    Object.assign(treeNode, frontmatterData);
  }

  // get the routes in this area if it's an area.
  let routesInArea: RouteNode[] = [];
  if (type === "area") {
    const areaPath = `/src/data/routes/${params.slug}/`;
    routesInArea = Object.entries(modules)
      .filter(([key]) => key.startsWith(areaPath) && key !== indexPath)
      .map(([key, value]) => {
        const relativePath = key.replace(areaPath, "").replace(".md", "");
        if (relativePath.includes("/")) {
          // This is a nested route, we only want direct children
          return null;
        }

        const childFrontmatterData = RouteFrontmatter(value.frontmatter);
        const childNode: TreeNode = {
          type: "route",
          name: relativePath.replaceAll("_", " "),
          link: `/routes/${params.slug}/${relativePath}`,
        };

        if (childFrontmatterData instanceof arktype.errors) {
          childNode.errors = childFrontmatterData;
        } else {
          Object.assign(childNode, childFrontmatterData);
        }

        return childNode;
      })
      .filter((node): node is RouteNode => node !== null);
  }

  return {
    html,
    treeNode,
    breadcrumbs,
    routesInArea,
  };
};
