import type { DataJSON } from "$lib/../climbing-data-gen/src/types";
export * from "$lib/../climbing-data-gen/src/types";

export interface BreadcrumbSegment {
  data: DataJSON;
  slug: string;
}

export type DataJSONRecord = Record<string, DataJSON>;

export interface AreaStats {
  totalRoutes: number;
}

export interface RecursiveData<D> {
  children?: Record<string, RecursiveData<D>>;
  own: D;
}
