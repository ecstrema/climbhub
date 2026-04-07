import { type as arktype } from "arktype";
import { type AreaNode, type RouteNode, type TreeNode, AreaFrontmatter, RouteFrontmatter } from "./types";


export function parseDataTree() {
  // Grab all files as a flat object: { "/src/data/...": "content" }
  const modules = import.meta.glob("/src/data/World/**/*.md", {
    eager: true,
  }) as Record<string, { html: string; frontmatter: Record<string, unknown> }>;

  const routeTree: AreaNode = {
    type: "area",
    name: "World",
    children: {},
    link: "/World/",
    parent: null,
  };

  // Iterate through the flat list of paths and build the tree
  for (const [path, { html, frontmatter }] of Object.entries(modules)) {
    // Clean the path to get segments (e.g., ["America", "Quebec", "Weir"])
    const cleanPath = path.replace("/src/data/World/", "");
    const segments = cleanPath.split("/").filter(Boolean)
    const fileName = segments[segments.length - 1];
    const isIndex = fileName === "index.md";
    segments[segments.length - 1] = segments[segments.length - 1].replace(".md", "")

    let currentNode = routeTree;

    const frontmatterData = isIndex ? AreaFrontmatter(frontmatter) : RouteFrontmatter(frontmatter);

    if (frontmatterData instanceof arktype.errors) {
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
          type: "area",
          name: segment.replaceAll("_", " "),
          link: `/World/${segments.slice(0, i + 1).join("/")}`,
          children: {},
          parent: currentNode,
        };
      }
      currentNode = currentNode.children[segment] as AreaNode;
    }

    // Assign frontmatterData to the node
    if (isIndex) {
      Object.assign(currentNode, frontmatterData, { html });
    } else {
      if (!currentNode.children) currentNode.children = {};
      currentNode.children[fileName] = {
        type: "route",
        name: fileName.replaceAll("_", " "),
        link: `/World/${cleanPath}`,
        html,
        parent: currentNode,
        ...frontmatterData,
      };
    }
  }

  return routeTree;
}

const dataTree = parseDataTree();

export function getDataTree() {
  return dataTree;
}

export function findNodeBySlug(slug: string): AreaNode | RouteNode | null {
  const segments = slug.split("/").filter(Boolean); // Split and remove empty segments
  let currentNode: AreaNode | RouteNode = dataTree;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]

    if (currentNode.type !== "area") {
      return null; // Can't navigate into a route
    }
    if (!currentNode.children || !currentNode.children[segment]) {
      return null; // Not found
    }
    currentNode = currentNode.children[segment] as AreaNode | RouteNode;
  }
  return currentNode;
}

export function getNodeSegments(node: TreeNode) {
  const segments = [];
  let n: TreeNode | null = node;
  do {
    segments.push({
      link: n.link,
      name: n.name,
    })
    n = n.parent;
  } while (n)

  return segments.toReversed();
}
