import type { GradeMapping, Scale, GradeType } from "../types";
import * as Self from "./hueco";

const _typecheck: Scale = Self;

export const nameShort = "Hueco";
export const nameLong = "Hueco Scale - V Scale";
export const description = "A bouldering grade system used primarily in North America.";

export const gradeType: GradeType = "boulder";

type Difficulty =
  | "B"
  | "0-"
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18;

export type Grades = `V${Difficulty}`;

export const gradeMapping: GradeMapping<Grades> = {
  VB: 25.5,
  "V0-": 50,
  V0: 56,
  V1: 62.5,
  V2: 64.5,
  V3: 67.5,
  V4: 71.5,
  V5: 75,
  V6: 77.5,
  V7: 79.5,
  V8: 82.5,
  V9: 85.5,
  V10: 87,
  V11: 88.5,
  V12: 90.5,
  V13: 92.5,
  V14: 94.5,
  V15: 96.5,
  V16: 98.5,
  V17: 100,
  V18: 102,
};

export function normalize(grade: string): Grades {
  const uppercaseGrade = grade.toUpperCase();
  if (uppercaseGrade in gradeMapping) {
    return uppercaseGrade as Grades;
  }

  throw new Error(`Invalid grade: ${grade}`);
}
