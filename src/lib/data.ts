import type { TreeNode, BreadcrumbSegment } from "./types";

/**
 * Derives breadcrumb segments from a TreeNode's path.
 * Example: "world/canada/quebec" ->
 * [
 *   { name: "World", link: "/World" },
 *   { name: "Canada", link: "/World/canada" },
 *   { name: "Quebec", link: "/World/canada/quebec" }
 * ]
 */
export function getNodeSegments(node: TreeNode): BreadcrumbSegment[] {
  if (!node || !node.path) return [];

  const segments = node.path.split("/");
  const breadcrumbs: BreadcrumbSegment[] = [];

  let currentPath = "";
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;

    // Capitalize first letter of segment for the name if it's "world" or similar
    // Actually, we should probably follow a naming convention or use the node's name for the last segment.
    let name = segment.charAt(0).toUpperCase() + segment.slice(1);

    // For the last segment, use the actual node name if available
    if (i === segments.length - 1 && node.name) {
      name = node.name;
    }

    breadcrumbs.push({
      name,
      link: `/World/${currentPath.replace(/^world\/?/, "")}`.replace(/\/$/, "") || "/World",
    });
  }

  return breadcrumbs;
}
