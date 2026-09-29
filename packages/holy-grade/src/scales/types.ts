export type GradeType = "route" | "boulder" | "ice" | "aid";

export type GradeMapping = Map<string, number>;

/**
 * Alternate spellings that mean exactly the same grade as a key in gradeMapping — e.g. a
 * Roman-numeral form of an Arabic-numeral scale (UIAA's "IV+" for "4+"), a historical name
 * ("3rd class" for YDS), or a differently-graded-but-equivalent clean-aid label ("C2" for
 * "A2"). Not for fuzzy/derived matching — every value here must be a real key of the same
 * scale's gradeMapping.
 */
export type AlternateNamesMapping = Map<string, string>;

export interface Scale<T extends ScaleId = ScaleId> {
  /** Can also be used as a shorter name alternative */
  id: T;
  name: string;
  description: string;
  gradeType: GradeType;
  /** The grade mapping is ordered, so it doesn't have to be sorted. */
  gradeMapping: GradeMapping;
  /**
   * Reverse of gradeMapping — a big array indexed by rank (`table[42]` is the grade at rank
   * 42, if any). Build with buildReverseTable(gradeMapping); every rank in gradeMapping is a
   * plain number, so this always works.
   */
  numberToGradeTable: (string | undefined)[];
  alternateNames?: AlternateNamesMapping;
  normalize: (grade: string) => string | undefined;
  /** Alternate name for the scale, e.g. "German" for UIAA. */
  nameAlt?: string;
  /** Where this scale is primarily used. */
  usedIn?: string;
  /** Emoji flag(s) for the scale's country/region of origin. */
  flags?: string;
  /** This scale's grades are tagged on OSM as `climbing:grade:<osmTagName>`. */
  osmTagName?: string;
  /**
   * How many times this scale's OSM tag was last seen, as a rough popularity indicator.
   * A static snapshot (not live) — there's no generator refreshing this anymore.
   */
  usageCount?: number;
}

export type RouteScaleId =
  | "French"
  | "YDS"
  | "UIAA"
  | "Saxon"
  | "UKTech"
  | "UKAdj"
  | "FrenchBritish"
  | "Scandinavian"
  | "Ewbank"
  | "Polish";
export type BoulderScaleId = "FB" | "Hueco";
export type IceScaleId = "WI" | "Mixed" | "DryTooling";
export type AidScaleId = "Aid";
export type ScaleId = RouteScaleId | BoulderScaleId | IceScaleId | AidScaleId;
