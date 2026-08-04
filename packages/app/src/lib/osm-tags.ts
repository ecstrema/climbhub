import type { Coordinates, OverpassElement } from "climbing-data-gen";
import type { Tags } from "osm-api";
import {
  French,
  YosemiteDecimal,
  getScale,
  UIAA,
  type GradeScalesTypes,
  Font,
} from "@openbeta/sandbag";

export type ProcessedTags = Record<string, (value: string) => boolean>;

export function allowAll(_value: string): boolean {
  return true;
}

export function allowSingleValue(value: string): (value: string) => boolean {
  return (v) => v === value;
}

export function allowMultipleValues(values: Set<string>): (value: string) => boolean {
  return (v) => values.has(v);
}

export function getNameOSM(tags: Tags): string | null {
  return tags.name || null;
}

const processedGrades: ProcessedTags = {
  "climbing:grade": allowAll,
  "climbing:grade:uiaa": UIAA.isType,
  "climbing:grade:yds": YosemiteDecimal.isType,
  "climbing:grade:yds_class": YosemiteDecimal.isType,
  "climbing:grade:french": French.isType,
  "climbing:grade:french_british": Font.isType,
  "climbing:grade:font": Font.isType,
  "climbing:grade:fontainebleau": Font.isType,
};

/** See https://wiki.openstreetmap.org/wiki/Climbing#Grading */
export function getGrade(tags: Tags): Grade | null {
  const grade =
    testKey("climbing:grade:uiaa", "uiaa") ||
    testKey("climbing:grade:yds", "yds") ||
    testKey("climbing:grade:yds_class", "yds") ||
    testKey("climbing:grade:french", "french") ||
    testKey("climbing:grade:french_british", "french") ||
    testKey("climbing:grade:font", "font") ||
    testKey("climbing:grade:fontainebleau", "font");

  if (grade) {
    return grade;
  }

  // If no grade was found, check for a generic climbing:grade tag
  const genericGrade = tags["climbing:grade"];
  if (genericGrade) {
    // Try to detect the scale from the value
    for (const scale of Object.keys(getScale) as GradeScalesTypes[]) {
      if (getScale(scale)?.isType(genericGrade)) {
        return { v: genericGrade, scale };
      }
    }

    // If no scale was detected, return the grade with an unknown scale
    return { v: genericGrade, scale: "unknown" };
  }

  return null;

  function testKey(key: string, scale: GradeScalesTypes): Grade | null {
    const v = tags[key];
    if (v) {
      if (getScale(scale)?.isType(v)) {
        // validate the grade, but ignore the result
        return { v, scale };
      } else {
        return { v, scale: "unknown" };
      }
    }

    return null;
  }
}

export function getDescription(tags: Tags): string | null {
  return tags["description"] || null;
}

export function getCoordinates(element: OverpassElement): Coordinates | null {
  if (element.type === "node") return { lon: element.lon, lat: element.lat };
  if (element.center) return { lon: element.center.lon, lat: element.center.lat };

  // TODO: element may have a geometry. Is that actually happening?
  // @ts-ignore
  if (element.geometry?.length > 0) {
    // @ts-ignore
    return { lon: element.geometry[0].lon, lat: element.geometry[0].lat };
  }

  return null;
}

export type Grade = {
  v: string;
  scale: GradeScalesTypes | "unknown";
};

export type ProcessingError = "GradeParsingError" | "GradeMissingScaleSpecifier";

export interface RouteNode {
  type: "route";
  grade?: Grade;
  name?: string;
  description?: string;
}

export interface AreaNode {
  type: "area";
  name?: string;
  description?: string;
}

export type ProcessedOSMData = RouteNode | AreaNode;

export function processOSM(element: OverpassElement): ProcessedOSMData | null {
  const tags = element.tags;
  if (!tags) {
    return null;
  }

  const name = getNameOSM(tags);
  const description = getDescription(tags);
  const grade = getGrade(tags);

  if (element.type === "node") {
    if (tags.climbing === "route_bottom" || tags.climbing === "route_top") {
      const v: RouteNode = {
        type: "route",
      };

      if (grade) v.grade = grade;
      if (description) v.description = description;
      if (name) v.name = name;

      return v;
    }
  }

  if (element.type === "way") {
    // TODO: where are the ways?
    return null;
  }

  if (element.type === "relation") {
    if (tags.climbing === "area" || tags.climbing === "crag") {
      const v: AreaNode = {
        type: "area",
      };

      if (name) v.name = name;
      if (description) v.description = description;
      return v;
    }
  }

  return null;
}

export const sharedProcessedTags: ProcessedTags = {
  sport: allowSingleValue("climbing"),
  name: allowAll,
  description: allowAll,
};

export const processedTags: Record<OverpassElement["type"], ProcessedTags> = {
  node: {
    ...sharedProcessedTags,
    ...processedGrades,
    climbing: allowMultipleValues(new Set(["route_bottom", "route_top"])),
  },
  way: {
    sport: allowSingleValue("climbing"),
  },
  relation: {
    ...sharedProcessedTags,
  },
};
