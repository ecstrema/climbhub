export interface TreeNode {
  id: string | number;
  name: string;
  type: "node" | "way" | "relation" | "route";
  path: string;
  hasChildren?: boolean;
  children?: TreeNode[];
  tags?: Record<string, string>;
}

export interface BreadcrumbSegment {
  name: string;
  link: string;
}
