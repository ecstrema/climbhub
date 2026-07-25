import type { DataJSON } from "$lib/../climbing_data_gen/src/types";
export * from "$lib/../climbing_data_gen/src/types";

export interface BreadcrumbSegment {
  name: string;
  link: string;
}

export type DataJSONRecord = Record<string, DataJSON>;

export interface AreaStats {
  totalRoutes: number;
}
