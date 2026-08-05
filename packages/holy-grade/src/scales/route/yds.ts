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
  IV: 2,
  V: 3,
  "5.4": 24,
  "5.5": 30,
  "5.6": 36,
  "5.7": 42,
  "5.8-": 46,
  "5.8": 48,
  "5.8+": 50,
  "5.9-": 52,
  "5.9": 54,
  "5.9+": 57,
  "5.10a": 60,
  "5.10a/b": 60.5,
  "5.10b": 61,
  "5.10b/c": 61.8,
  "5.10c": 62.5,
  "5.10c/d": 63.5,
  "5.10d": 64.5,
  "5.10d/11a": 65.5,
  "5.11a": 66.5,
  "5.11a/b": 67.3,
  "5.11b": 68,
  "5.11b/c": 68.8,
  "5.11c": 69.5,
  "5.11c/d": 70.5,
  "5.11d": 71.5,
  "5.11d/12a": 72.5,
  "5.12a": 73.5,
  "5.12a/b": 74.5,
  "5.12b": 75.5,
  "5.12b/c": 76.3,
  "5.12c": 77,
  "5.12c/d": 77.8,
  "5.12d": 78.5,
  "5.12d/13a": 79.5,
  "5.13a": 80.5,
  "5.13a/b": 81.5,
  "5.13b": 82.5,
  "5.13b/c": 83.3,
  "5.13c": 84,
  "5.13c/d": 84.8,
  "5.13d": 85.5,
  "5.13d/14a": 86.5,
  "5.14a": 87.5,
  "5.14a/b": 88.5,
  "5.14b": 89.5,
  "5.14b/c": 90.5,
  "5.14c": 91.5,
  "5.14c/d": 92.5,
  "5.14d": 93.5,
  "5.14d/15a": 94.5,
  "5.15a": 95.5,
  "5.15a/b": 96.5,
  "5.15b": 97.5,
  "5.15b/c": 98.3,
  "5.15c": 99,
  "5.15c/d": 99.5,
  "5.15d": 100,
  "5.15d/16a": 100.5,
  "5.16a": 101,
};

type ExtendedPossibleUnits = "0" | "1" | "2" | "3" | "4" | "5";
type ExtendedPossibleSign = "+" | "-";
type ExtendedGrades = `5.1${ExtendedPossibleUnits}${ExtendedPossibleSign}`;

export const extendedGradeNormalizationMapping: Record<ExtendedGrades, Grades> = {
  "5.10-": "5.10a/b",
  "5.10+": "5.10c/d",
  "5.11-": "5.11a/b",
  "5.11+": "5.11c/d",
  "5.12-": "5.12a/b",
  "5.12+": "5.12c/d",
  "5.13-": "5.13a/b",
  "5.13+": "5.13c/d",
  "5.14-": "5.14a/b",
  "5.14+": "5.14c/d",
  "5.15-": "5.15a/b",
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
