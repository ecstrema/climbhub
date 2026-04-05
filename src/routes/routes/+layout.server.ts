import { AreaFrontmatter, RouteFrontmatter, type AreaNode, type RouteNode } from "$lib/types"
import { type } from "arktype"
import type { LayoutServerLoad } from "./$types"

export const load: LayoutServerLoad = async () => {
  // 1. Grab all files as a flat object: { "/src/data/...": "content" }
  const modules = import.meta.glob('/src/data/routes/**/*.md', {
    eager: true,
  }) as Record<string, { html: string; frontmatter: Record<string, unknown> }>;

  const routeTree: AreaNode = {
    kind: "area",
    name: "World",
    children: {},
    link: "/routes/"
  };

  // 2. Iterate through the flat list of paths and build the tree
  for (const [path, { html, frontmatter }] of Object.entries(modules)) {
    // Clean the path to get segments (e.g., ["America", "Quebec", "Weir"])
    const cleanPath = path.replace('/src/data/routes/', '').replace('.md', '');
    const segments = cleanPath.split('/');
    const fileName = segments[segments.length - 1];

    let currentNode = routeTree;

    const isIndex = fileName === "index";

    const frontmatterData = isIndex
      ? AreaFrontmatter(frontmatter)
      : RouteFrontmatter(frontmatter);

    if (frontmatterData instanceof type.errors) {
      currentNode.errors = frontmatterData;
      continue;
    }

    // If segments are ["USA", "Colorado", "Rifle", "index"], we loop through ["USA", "Colorado", "Rifle"]
    // If segments are ["USA", "Colorado", "Rifle", "Opie"], we loop through ["USA", "Colorado", "Rifle"]
    const parentSegments = segments.slice(0, -1);

    for (let i = 0; i < parentSegments.length; i++) {
      const segment = segments[i];
      if (!currentNode.children) currentNode.children = {};

      if (!currentNode.children[segment]) {
        currentNode.children[segment] = {
          kind: "area",
          name: frontmatterData.name || segment.replaceAll("_", " "),
          link: `/routes/${segments.slice(0, i + 1).join('/')}`,
          children: {}
        };
      }
      currentNode = currentNode.children[segment] as AreaNode;
    }

    // 5. Assign frontmatterData to the node
    if (isIndex) {
      Object.assign(currentNode, frontmatterData);
    } else {
      if (!currentNode.children) currentNode.children = {};
      currentNode.children[fileName] = {
        kind: "route",
        name: fileName.replaceAll("_", " "),
        link: `/routes/${cleanPath}`,
        ...frontmatterData
      };
    }
  }

  return { routeTree };
};
