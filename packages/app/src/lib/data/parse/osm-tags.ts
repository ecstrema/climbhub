import type { OsmFeature } from "osm-api";
import type { Coordinates } from "@climbhub/climbing-data-gen";
import { allScales, getReference, getScale, parseGrade, type Scale, type ScaleId } from "@climbhub/holy-grade";
import type { Key, Tags } from "osm-api";
import type { Grade } from "#lib/types.js";

export type ProcessedTags = Partial<Record<Key, (value: string) => boolean>>;

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

export function getNameOSM(tags: Tags): string | undefined {
  return tags.name;
}

const climbingStyleLabels = [
  ["sport", "Sport"],
  ["trad", "Trad"],
  ["boulder", "Boulder"],
  ["toprope", "Top rope"],
  ["speed", "Speed"],
  ["multipitch", "Multi-pitch"],
  ["ice", "Ice"],
  ["mixed", "Mixed"],
  ["dry", "Dry tooling"],
  ["aid", "Aid"],
  ["deepwater", "Deep-water solo"],
] as const;

export function getClimbingStyles(tags: Tags) {
  return climbingStyleLabels.flatMap(([key, label]) => {
    const value = tags[`climbing:${key}` as Key]?.trim();
    if (!value || value.toLowerCase() === "no") return [];
    const count = /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : undefined;
    return [{ key, label, count }];
  });
}

export function getPhone(tags: Tags): string | undefined {
  return tags.phone?.trim() || tags["contact:phone"]?.trim() || undefined;
}

const gradeTags: [Key, ScaleId][] = [
  ["climbing:grade:uiaa", "UIAA"],
  ["climbing:grade:yds_class", "YDS"],
  ["climbing:grade:yds", "YDS"],
  ["climbing:grade:french", "French"],
  ["climbing:grade:french_british", "French"],
  ["climbing:grade:fb", "FB"],
  ["climbing:grade:font", "FB"],
  ["climbing:grade:fontainebleau", "FB"],
  ["climbing:grade:hueco", "Hueco"],
  ["climbing:grade:vscale", "Hueco"],
  ["climbing:grade:saxon", "Saxon"],
  ["climbing:grade:norwegian", "Scandinavian"],
  ["climbing:grade:british_adjectival", "UKAdj"],
  ["climbing:grade:british_technical", "UKTech"],
  ["climbing:grade:ewbank", "Ewbank"],
  ["climbing:grade:polish", "Polish"],
  ["climbing:grade:ice", "WI"],
  ["climbing:grade:mixed", "Mixed"],
  ["climbing:grade:dry", "DryTooling"],
  ["climbing:grade:aid", "Aid"],
  ["climbing:grade:yds_danger", "YDSDanger"],
];
const processedGrades: ProcessedTags = {
  "climbing:grade": allowAll,
  ...Object.fromEntries(gradeTags.map(([key, scale]) => [key, allowFromNormalize(getScale(scale)!.normalize)])),
};

export function scaleIdToTag(s: ScaleId): Key | undefined {
  return gradeTags.find(([, scale]) => scale === s)?.[0];
}

/** See https://wiki.openstreetmap.org/wiki/Climbing#Grading */
export function getGrade(tags: Tags): WithSourceTag<Grade> | undefined {
  const grade = gradeTags.map(([key, scale]) => testKey(key, scale)).find(Boolean);

  if (grade) {
    return grade;
  }

  // If no grade was found, check for a generic climbing:grade tag
  const genericGrade = tags["climbing:grade"];
  if (genericGrade) {
    const parsed = parseGrade(genericGrade);
    if (parsed?.primary) {
      return {
        v: { v: parsed.primary.grade, scale: parsed.primary.scale },
        source: "climbing:grade",
      };
    }
    if (parsed?.danger) {
      return {
        v: { v: parsed.danger.grade, scale: parsed.danger.scale },
        source: "climbing:grade",
      };
    }

    // Try to detect the scale from the value
    for (const scale of allScales) {
      const g = scale.normalize(genericGrade);
      if (g)
        return {
          v: { v: g, scale: scale.id },
          source: "climbing:grade",
        };
    }

    // If no scale was detected, return the grade with an unknown scale
    return {
      v: { v: genericGrade, scale: "unknown" },
      source: "climbing:grade",
    };
  }

  return undefined;

  function testKey(key: Key, scale: ScaleId): WithSourceTag<Grade> | undefined {
    const v = tags[key];
    if (v) {
      const parsed = parseGrade(v, scale);
      const normalized = parsed?.primary?.grade ?? getScale(scale)!.normalize(v);
      // validate the grade, but ignore the result
      return {
        v: normalized ? { v: normalized, scale } : { v, scale: "unknown" },
        source: key,
      };
    }
  }
}

export interface ParsedClimbingLength {
  meters: number;
  sourceUnit: "meters" | "feet";
}

const lengthValidator = (value: string) => /^\d+(\.\d+)?$/.test(value.trim());

export function parseClimbingLength(value: string | undefined): ParsedClimbingLength | undefined {
  const normalized = value?.trim().replace(",", ".");
  if (!normalized) return;

  const meters = normalized.match(/^(\d+(?:\.\d+)?)\s*(?:m|meters?|metres?)?$/i);
  if (meters) return { meters: Number(meters[1]), sourceUnit: "meters" };

  const feet = normalized.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)$/i);
  if (feet) return { meters: Number(feet[1]) * 0.3048, sourceUnit: "feet" };
}

/**
 * Length of a route in metres, as `climbing:length`.
 * See https://wiki.openstreetmap.org/wiki/Climbing#Route_properties
 */
export function getLength(tags: Tags): number | undefined {
  return parseClimbingLength(tags["climbing:length"])?.meters;
}

export function getDescription(tags: Tags): string | undefined {
  return tags.description || undefined;
}

export function getCoordinates(element: OsmFeature): Coordinates | undefined {
  if (element.type === "node") return { lon: element.lon, lat: element.lat };
  // @ts-ignore
  if (element.center) return { lon: element.center.lon, lat: element.center.lat };

  // TODO: element may have a geometry. Is that actually happening?
  // @ts-ignore
  if (element.geometry?.length > 0) {
    // @ts-ignore
    return { lon: element.geometry[0].lon, lat: element.geometry[0].lat };
  }
}

export type ProcessingError = "GradeParsingError" | "GradeMissingScaleSpecifier";

/** We add the source tag to the processed value, so we can bind to it and modify the right value. */
export type WithSourceTag<T> = { v: T; source: Key };

export type OSMClimbingFeatureType = "route" | "area" | "gym";

const routeClimbingValues = new Set([
  "route_bottom",
  "route_top",
  "route",
  "route_start",
  "abseil_route",
  "abseil",
  "toprope",
  "drytooling",
]);
const areaClimbingValues = new Set(["area", "crag", "boulder", "bouldering"]);
const gymClimbingValues = new Set(["indoor_wall", "artificial_wall", "wall", "gym"]);
const gymLeisureValues = new Set(["sports_centre", "sports_hall", "fitness_centre", "sport_centre"]);

function hasClimbingValue(value: string | undefined, acceptedValues: ReadonlySet<string>) {
  if (!value) return false;
  if (acceptedValues.has(value)) return true;
  return value.includes(";") && value.split(";").some((part) => acceptedValues.has(part.trim()));
}

export function featureToTypeOSM(feature: OsmFeature): OSMClimbingFeatureType | undefined {
  if (!feature.tags) return;

  const tags = feature.tags;
  if (hasClimbingValue(tags.climbing, routeClimbingValues)) return "route";

  if (hasClimbingValue(tags.climbing, areaClimbingValues)) return "area";

  if (
    hasClimbingValue(tags.climbing, gymClimbingValues) ||
    tags.leisure === "pitch" ||
    (tags.sport === "climbing" && gymLeisureValues.has(tags.leisure || ""))
  ) {
    return "gym";
  }

  // The world import also includes climbing POIs without a more specific climbing tag.
  if (tags.sport === "climbing") return "area";
}

export const sharedProcessedTags: ProcessedTags = {
  name: allowAll,
  description: allowAll,
  sport: allowSingleValue("climbing"),
};

export const processedTags: Record<OSMClimbingFeatureType, ProcessedTags> = {
  route: {
    ...sharedProcessedTags,
    ...processedGrades,
    "climbing:length": lengthValidator,
    climbing: allowMultipleValues(new Set(["route_bottom", "route_top"])),
  },
  area: {
    ...sharedProcessedTags,
    climbing: allowMultipleValues(new Set(["crag", "area"])),
    type: allowSingleValue("site"),
  },
  gym: {
    ...sharedProcessedTags,
    leisure: allowMultipleValues(gymLeisureValues),
    climbing: allowMultipleValues(gymClimbingValues),
    phone: allowAll,
    "contact:phone": allowAll,
    website: allowAll,
    "contact:website": allowAll,
    url: allowAll,
    opening_hours: allowAll,
    fee: allowMultipleValues(new Set(["yes", "no"])),
    charge: allowAll,
    ...Object.fromEntries(climbingStyleLabels.map(([key]) => [`climbing:${key}`, allowAll])),
  },
};

export function getGradeReference(tags: Tags): number | undefined {
  const grade = getGrade(tags)?.v;
  if (!grade || grade.scale === "unknown") return;

  const scale = getScale(grade.scale);
  if (!scale) return;

  const reference = getReference(grade.v, scale);
  return reference;
}
