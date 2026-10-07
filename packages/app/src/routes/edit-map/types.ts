import type { YamlConfig } from "@climbhub/reverse-geocoding-data";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";

export type Boundary = FeatureCollection<Polygon | MultiPolygon>;

export interface ConfigFile {
  /** `config.yaml` or `<name>.config.yaml` */
  file: string;
  config: YamlConfig;
  /** Original text of the file, to write it back untouched when it is not modified */
  raw?: string;
}

/** A directory of packages/reverse-geocoding-data, as sent by /api/edit-map/tree.json */
export interface ServerTreeNode {
  slug: string;
  configs: ConfigFile[];
  /** `manual` when it comes from data/, `generated` when it comes from output/ */
  boundarySource?: "manual" | "generated";
  boundary?: Boundary;
  children: ServerTreeNode[];
}
