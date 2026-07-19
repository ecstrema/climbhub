// Folder is for geographic hierarchy, the others come from OSM.
export type NodeType = "folder" | "node" | "way" | "relation";

// keys to write the "element.json" file
export interface ElementData {
  path: string /** URL-safe relative path (e.g., 'canada/quebec/val-david') */;
  name: string /** Display name */;
  type: "folder" | "route" | "gym";
}

export interface OverpassNodeElement {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

export interface OverpassWayElement {
  type: "way";
  id: number;
  center: {
    lat: number;
    lon: number;
  };
  nodes: number[];
  tags: Record<string, string>;
}

export interface OverpassRelationElement {
  type: "relation";
  id: number;
  center?: {
    lat: number;
    lon: number;
  };
  members: {
    type: "way" | "relation" | "node";
    ref: number;
    role: string;
  }[];
  tags: Record<string, string>;
}

export type OverpassElement = OverpassNodeElement | OverpassWayElement | OverpassRelationElement;

export interface OverpassRequest {
  version: number;
  generator: string;
  osm3s: {
    timestamp_osm_base: string;
    timestamp_areas_base: string;
    copyright: string;
  };
  elements: OverpassElement[];
}
