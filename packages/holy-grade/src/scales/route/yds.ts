import type { GradeMapping, Scale, GradeType } from "../types";
import * as Self from "./yds";

const _typecheck: Scale = Self;

export const nameShort = "YDS";
export const nameLong = "Yosemite Decimal System (YDS)";
export const description = "North american route standard.";

export const gradeType: GradeType = "route";

type Qualifier = "a" | "b" | "c" | "d" | "a/b" | "b/c" | "c/d";
type Units = "0" | "1" | "2" | "3" | "4" | "5";

export type Grades =
  | "III"
  | "IV"
  | "V"
  | "5.2"
  | "5.3"
  | "5.4"
  | "5.5"
  | "5.6"
  | "5.7"
  | "5.8-"
  | "5.8"
  | "5.8+"
  | "5.9-"
  | "5.9"
  | "5.9+"
  | "5.10d/11a"
  | "5.11d/12a"
  | "5.12d/13a"
  | "5.13d/14a"
  | "5.14d/15a"
  | "5.15d/16a"
  | `5.1${Units}${Qualifier}`
  | "5.16a";

export const gradeMapping: GradeMapping<Grades> = {
  III: 1,
  IV: 13,
  "5.2": 19,
  "5.3": 22,
  "5.4": 25,
  "5.5": 30,
  "5.6": 36,
  "5.7": 42,
  "5.8-": 46,
  "5.8": 48,
  "5.8+": 50,
  "5.9-": 52,
  "5.9": 54,
  "5.9+": 57,
  ...Object.fromEntries(
    [
      "5.10a",
      "5.10a/b",
      "5.10b",
      "5.10b/c",
      "5.10c",
      "5.10c/d",
      "5.10d",
      "5.10d/11a",
      "5.11a",
      "5.11a/b",
      "5.11b",
      "5.11b/c",
      "5.11c",
      "5.11c/d",
      "5.11d",
    ].map((grade, index, a) => [grade, 61 + index * (12 / (a.length - 1))] as const),
  ),
  ...Object.fromEntries(
    [
      "5.11d/12a",
      "5.12a",
      "5.12a/b",
      "5.12b",
      "5.12b/c",
      "5.12c",
      "5.12c/d",
      "5.12d",
      "5.12d/13a",
      "5.13a",
      "5.13a/b",
      "5.13b",
      "5.13b/c",
      "5.13c",
      "5.13c/d",
      "5.13d",
      "5.13d/14a",
      "5.14a",
      "5.14a/b",
      "5.14b",
      "5.14b/c",
      "5.14c",
      "5.14c/d",
      "5.14d",
      "5.14d/15a",
      "5.15a",
      "5.15a/b",
      "5.15b",
      "5.15b/c",
      "5.15c",
      "5.15c/d",
      "5.15d",
      "5.15d/16a",
      "5.16a",
      "5.16a/b",
      "5.16b",
    ].map((grade, index) => [grade, 74 + index] as const),
  ),
} as GradeMapping<Grades>;

type ExtendedPossibleUnits = "0" | "1" | "2" | "3" | "4" | "5";
type ExtendedPossibleSign = "+" | "-" | "";
type ExtendedGrades = `5.1${ExtendedPossibleUnits}${ExtendedPossibleSign}` | "V";

export const extendedGradeNormalizationMapping: Record<ExtendedGrades, Grades> = {
  V: "5.4",
  "5.10-": "5.10a/b",
  "5.10": "5.10b/c",
  "5.10+": "5.10c/d",
  "5.11-": "5.11a/b",
  "5.11": "5.11b/c",
  "5.11+": "5.11c/d",
  "5.12-": "5.12a/b",
  "5.12": "5.12b/c",
  "5.12+": "5.12c/d",
  "5.13-": "5.13a/b",
  "5.13": "5.13b/c",
  "5.13+": "5.13c/d",
  "5.14-": "5.14a/b",
  "5.14": "5.14b/c",
  "5.14+": "5.14c/d",
  "5.15-": "5.15a/b",
  "5.15": "5.15b/c",
  "5.15+": "5.15c/d",
};

export function normalize(grade: string): Grades {
  if (grade in gradeMapping) {
    return grade as Grades;
  }

  if (grade in extendedGradeNormalizationMapping) {
    return extendedGradeNormalizationMapping[grade as ExtendedGrades];
  }

  throw new Error(`Invalid grade: ${grade}`);
}
