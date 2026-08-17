import type { DataJSON } from "climbing-data-gen";

export interface BreadcrumbSegment {
  data: DataJSON;
  slug: string;
}

export type DataJSONRecord = Record<string, DataJSON>;
export type AreaStatsRecord = Record<string, AreaStats>;

export interface AreaStats {
  totalRoutes: number;
}

export interface DataTree {
  children?: Record<string, DataTree>;
  own: DataJSON;
  stats?: AreaStats;
}
