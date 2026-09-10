import type { DataJSON } from "@climbhub/climbing-data-gen";
import type { OsmFeature } from "osm-api";

export interface BreadcrumbSegment {
  data?: DataTree;
  slug: string;
}

export type DataJSONRecord = Record<string, DataJSON>;
export type AreaStatsRecord = Record<string, AreaStats>;

export interface AreaStats {
  totalRoutes: number;
}

/** Tree structure for the OSM data.
 *
 * Use the type parameter to set the particular type of the contained feature. For example, if you know the feature is not a 'geographic' feature, set the type to {@link OsmFeature}.
 **/
export interface DataTree<Feature extends DataJSON = DataJSON> {
  childrenFetched?: true;
  children?: Record<string, DataTree>;
  feature: Feature;
  stats?: AreaStats;
}
