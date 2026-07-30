import type { DataJSON, DataJSONRecord, OverpassElement } from "./types";
import { getName as getNameOSM } from "./osm-tags";

/** Folders use .name, OSM elements usually store their name in .tags.name */
export function getName(element: DataJSON) {
  if (element.type === "geographic") {
    return element.name;
  }
  return getNameOSM(element);
}

export function recursiveDataJSONFromRecord(record: DataJSONRecord) {
  return Object.fromEntries(
    Object.entries(record).map(([key, val]) => [
      key,
      {
        own: val,
      },
    ]),
  );
}

export interface GeographicData {
  type: "geographic";
  name: string;
}

// TODO: real grade conversion lib
export type Grade = string;

export interface RouteNode {
  type: "route";
  grade: Grade;
  name: string;
  description: string;
}

export interface AreaNode {
  type: "area";
  name: string;
  description: string;
}

export type ProcessedData = GeographicData | RouteNode | AreaNode;

export const processedGrades: Record<string, (string | RegExp)[]> = {
  "climbing:grade:french": [""],
  "climbing:grade:yds": [""],
  "climbing:grade:uiaa": [""],
};

export const processedTags: Record<OverpassElement["type"], Record<string, (string | RegExp)[]>> = {
  node: {
    sport: ["climbing"],
    climbing: ["route_bottom", "route_top"],
    ...processedGrades,
  },
  way: {
    sport: ["climbing"],
    climbing: ["route_bottom", "route_top"],
    ...processedGrades,
  },
  relation: {},
};

export function process(element: DataJSON): ProcessedData | null {
  if (element.type === "geographic") {
    return {
      type: "geographic",
      name: element.name,
    };
  }

  const tags = element.tags;
  if (!tags) {
    return null;
  }

  if (element.type === "node") {
    if (tags.climbing === "route_bottom" || tags.climbing === "route_top") {
      return {
        type: "route",
        grade:
          tags["climbing:grade:french"] ||
          tags["climbing:grade:yds"] ||
          tags["climbing:grade:uiaa"],
        description: tags.description,
        name: tags.name,
      };
    }
  }

  if (element.type === "way") {
    if (tags.climbing === "route_bottom" || tags.climbing === "route_top") {
      return {
        type: "route",
        grade:
          tags["climbing:grade:french"] ||
          tags["climbing:grade:yds"] ||
          tags["climbing:grade:uiaa"],
        description: tags.description,
        name: tags.name,
      };
    }
  }

  if (element.type === "relation") {
    if (tags.climbing === "area" || tags.climbing === "crag") {
      return {
        type: "area",
        name: tags.name,
        description: tags.description,
      };
    }
  }

  return null;
}
