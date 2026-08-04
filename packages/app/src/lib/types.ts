import type { DataJSON } from "climbing-data-gen";

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
