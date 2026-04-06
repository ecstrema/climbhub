import { error } from "@sveltejs/kit";
import { type } from "arktype";
import { AreaFrontmatter, RouteFrontmatter, type AreaNode } from "$lib/types";
import type { PageServerLoad } from "./$types";

type RoutePageProps = {
  html: string;
  treeNode: any; // This will be either a RouteNode or an AreaNode, but we can determine that in the component based on the "kind" property.
  breadcrumbs: { name: string; link: string }[];
}

export const load: PageServerLoad = async ({ params }): Promise<RoutePageProps> => {
  // 1. Grab the processed modules
  // Note: No need for ?raw or manual parsing; the plugin handles it.
  const modules = import.meta.glob("/src/data/routes/**/*.md", {
    eager: true,
  }) as Record<string, { html: string; frontmatter: Record<string, unknown> }>;

  const routePath = `/src/data/routes/${params.slug}.md`;
  const indexPath = `/src/data/routes/${params.slug}/index.md`;

  let module = modules[routePath];
  let kind: "route" | "area" = "route";

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
      kind = "area";
    } else {
      // Check if it's a folder that exists but has no index.md
      // We verify if any known markdown file exists inside this path
      const folderExists = Object.keys(modules).some((key) =>
        key.startsWith(`/src/data/routes/${params.slug}/`),
      );

      if (folderExists) {
        return {
          html: "", // No content because there's no index.md
          treeNode: {
            kind: "area",
            name: params.slug.split("/").pop()?.replaceAll("_", " ") || "",
            link: `/routes/${params.slug}`,
          } satisfies AreaNode,
          breadcrumbs,
        };
      }

      throw error(404, `Route or Area ${params.slug} not found`);
    }
  }

  // Validate with Arktype
  const { html, frontmatter } = module;
  const frontmatterData =
    kind === "area" ? AreaFrontmatter(frontmatter) : RouteFrontmatter(frontmatter);

  // Construct the node
  const treeNode: any = {
    kind,
    name: params.slug.split("/").pop()?.replaceAll("_", " ") || "",
    link: `/routes/${params.slug}`,
  };

  if (frontmatterData instanceof type.errors) {
    treeNode.errors = frontmatterData;
  } else {
    Object.assign(treeNode, frontmatterData);
  }


  return {
    html,
    treeNode,
    breadcrumbs,
  };
};
