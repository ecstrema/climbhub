import type { Coordinates, OverpassElement } from "climbing-data-gen";
import {
  allScales,
  allScalesMap,
  fb,
  french,
  uiaa,
  yds,
  type Scale,
  type ScaleId,
} from "holy-grade";
import type { Tags } from "osm-api";

export type ProcessedTags = Record<string, (value: string) => boolean>;

export function allowAll(_value: string): boolean {
  return true;
}

export function allowSingleValue(value: string): (value: string) => boolean {
  return (v) => v === value;
}

export function allowFromNormalize(normalize: Scale["normalize"]): (value: string) => boolean {
  return (v) => {
    try {
      normalize(v);
      return true;
    } catch {
      return false;
    }
  };
}

export function allowMultipleValues(values: Set<string>): (value: string) => boolean {
  return (v) => values.has(v);
}

export function getNameOSM(tags: Tags): string | null {
  return tags.name || null;
}

const YDSValidator = allowFromNormalize(yds.normalize);
const FrenchValidator = allowFromNormalize(french.normalize);
const FBValidator = allowFromNormalize(fb.normalize);
const UIAAValidator = allowFromNormalize(uiaa.normalize);
const processedGrades: ProcessedTags = {
  "climbing:grade": allowAll,
  "climbing:grade:uiaa": UIAAValidator,
  "climbing:grade:yds": YDSValidator,
  "climbing:grade:yds_class": YDSValidator,
  "climbing:grade:french": FrenchValidator,
  "climbing:grade:fb": FBValidator,
  "climbing:grade:french_british": FBValidator,
  "climbing:grade:font": FBValidator,
  "climbing:grade:fontainebleau": FBValidator,
};

/** See https://wiki.openstreetmap.org/wiki/Climbing#Grading */
export function getGrade(tags: Tags): Grade | null {
  const grade =
    testKey("climbing:grade:uiaa", "UIAA") ||
    testKey("climbing:grade:yds", "YDS") ||
    testKey("climbing:grade:yds_class", "YDS") ||
    testKey("climbing:grade:french", "French") ||
    testKey("climbing:grade:french_british", "French") ||
    testKey("climbing:grade:font", "FB") ||
    testKey("climbing:grade:fontainebleau", "FB") ||
    testKey("climbing:grade:hueco", "Hueco") ||
    testKey("climbing:grade:vscale", "Hueco");

  if (grade) {
    return grade;
  }

  // If no grade was found, check for a generic climbing:grade tag
  const genericGrade = tags["climbing:grade"];
  if (genericGrade) {
    // Try to detect the scale from the value
    for (const scale of allScales) {
      const g = scale.normalize(genericGrade);
      if (g) return { v: g, scale: scale.id };
    }

    // If no scale was detected, return the grade with an unknown scale
    return { v: genericGrade, scale: "unknown" };
  }

  return null;

  function testKey(key: string, scale: ScaleId): Grade | null {
    const v = tags[key];
    if (v) {
      const normalized = allScalesMap[scale].normalize(v);
      // validate the grade, but ignore the result
      return normalized ? { v: normalized, scale } : { v, scale: "unknown" };
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
  scale: ScaleId | "unknown";
};

export type ProcessingError = "GradeParsingError" | "GradeMissingScaleSpecifier";

export interface RouteNode {
  type: "route";
  grade?: Grade;
  name?: string;
  description?: string;
  coordinates?: Coordinates;
}

export interface AreaNode {
  type: "area";
  name?: string;
  description?: string;
  coordinates?: Coordinates;
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
  const coordinates = getCoordinates(element);

  if (element.type === "node") {
    if (tags.climbing === "route_bottom" || tags.climbing === "route_top") {
      const v: RouteNode = {
        type: "route",
      };

      if (grade) v.grade = grade;
      if (description) v.description = description;
      if (name) v.name = name;
      if (coordinates) v.coordinates = coordinates;

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
      if (coordinates) v.coordinates = coordinates;

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
