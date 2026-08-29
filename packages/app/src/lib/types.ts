import type { DataJSON } from "@climbhub/climbing-data-gen";

export interface BreadcrumbSegment {
  data: DataJSON;
  slug: string;
}

export type DataJSONRecord = Record<string, DataJSON>;
export type AreaStatsRecord = Record<string, AreaStats>;

export interface AreaStats {
  totalRoutes: number;
}

export interface DataTree<Feature extends DataJSON = DataJSON> {
  children?: Record<string, DataTree>;
  feature: Feature;
  stats?: AreaStats;
}
