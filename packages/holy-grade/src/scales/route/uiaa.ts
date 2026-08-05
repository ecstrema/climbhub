import type { GradeMapping, Scale, GradeType } from "../types";
import * as Self from "./uiaa";

const _typecheck: Scale = Self;

export const nameShort = "UIAA";
export const nameLong = "International Climbing and Mountaineering Federation (UIAA) Scale";
export const description =
  "The UIAA scale is used in Germany, Austria and Switzerland among others.";

export const gradeType: GradeType = "route";

type Qualifiers = "+" | "-";

export type Grades =
  | "1"
  | "2"
  | "3"
  | "4"
  | "4+"
  | `${5 | 6 | 7 | 8 | 9 | 10 | 11 | 12}${Qualifiers | ""}`;

export const gradeMapping: GradeMapping<Grades> = {
  1: 2,
  2: 6.5,
  3: 12.5,
  4: 18.5,
  "4+": 24.5,
  "5-": 30.5,
  5: 36.5,
  "5+": 42.5,
  "6-": 48.5,
  6: 54.5,
  "6+": 59,
  "7-": 61.5,
  7: 63.5,
  "7+": 65.5,
  "8-": 68,
  8: 70.5,
  "8+": 72.5,
  "9-": 74.5,
  9: 77,
  "9+": 79.5,
  "10-": 81.5,
  10: 84,
  "10+": 86.5,
  "11-": 88.5,
  11: 90.5,
  "11+": 93,
  "12-": 95.5,
  12: 97.5,
  "12+": 99.5,
};

export type ExtendedGrades =
  | "I"
  | "II"
  | "III"
  | "IV"
  | "IV+"
  | `${"V" | "VI" | "VII" | "VIII" | "IX" | "X" | "XI" | "XII"}${Qualifiers | ""}`;

export const extendedGradeNormalizationMapping: Record<string, Grades> = {
  I: "1",
  II: "2",
  III: "3",
  IV: "4",
  "IV+": "4+",
  "V-": "5-",
  V: "5",
  "V+": "5+",
  "VI-": "6-",
  VI: "6",
  "VI+": "6+",
  "VII-": "7-",
  VII: "7",
  "VII+": "7+",
  "VIII-": "8-",
  VIII: "8",
  "VIII+": "8+",
  "IX-": "9-",
  IX: "9",
  "IX+": "9+",
  "X-": "10-",
  X: "10",
  "X+": "10+",
  "XI-": "11-",
  XI: "11",
  "XI+": "11+",
  "XII-": "12-",
  XII: "12",
  "XII+": "12+",
};

export function normalize(grade: string): Grades {
  const loweredGrade = grade.toLowerCase();
  if (loweredGrade in gradeMapping) {
    return loweredGrade as Grades;
  }

  throw new Error(`Invalid grade: ${grade}`);
}
