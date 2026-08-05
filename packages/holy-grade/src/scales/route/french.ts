import type { GradeMapping, Scale, GradeType } from "../types";
import * as Self from "./french";

const _typecheck: Scale = Self;

export const nameShort = "French";
export const nameLong = "French Scale";
export const description =
  "Now the most common scale in the world, used in Europe and many other countries.";

export const gradeType: GradeType = "route";

type Qualifiers = "a" | "b" | "c" | "a+" | "b+" | "c+";
export type Grades =
  | `${1 | 2 | 3 | 4 | 5}${Qualifiers | ""}`
  | `${6 | 7 | 8 | 9}${Qualifiers}`
  | "10a";

export const gradeMapping: GradeMapping<Grades> = {
  "1": 1,
  "1a": 1.5,
  "1a+": 3,
  "1b": 4,
  "1b+": 5,
  "1c": 6,
  "1c+": 6.5,
  "2": 7.5,
  "2a": 7.5,
  "2a+": 8.5,
  "2b": 9.5,
  "2b+": 10.5,
  "2c": 11.5,
  "2c+": 12.5,
  "3": 14,
  "3a": 14,
  "3a+": 15,
  "3b": 16,
  "3b+": 17,
  "3c": 18,
  "3c+": 19,
  "4": 20.5,
  "4a": 20.5,
  "4a+": 26.5,
  "4b": 27,
  "4b+": 33,
  "4c": 33.5,
  "4c+": 39.5,
  "5": 40,
  "5a": 40,
  "5a+": 46.5,
  "5b": 47,
  "5b+": 53,
  "5c": 54,
  "5c+": 59,
  "6a": 60,
  "6a+": 61,
  "6b": 62.5,
  "6b+": 64.5,
  "6c": 66.5,
  "6c+": 68.5,
  "7a": 70.5,
  "7a+": 72.5,
  "7b": 74,
  "7b+": 75.5,
  "7c": 77.5,
  "7c+": 79.5,
  "8a": 81.5,
  "8a+": 83.5,
  "8b": 85.5,
  "8b+": 87,
  "8c": 88.5,
  "8c+": 90.5,
  "9a": 92.5,
  "9a+": 94.5,
  "9b": 96.5,
  "9b+": 98.5,
  "9c": 100,
  "9c+": 102,
  "10a": 104,
};

export function normalize(grade: string): Grades {
  const loweredGrade = grade.toLowerCase();
  if (loweredGrade in gradeMapping) {
    return loweredGrade as Grades;
  }

  throw new Error(`Invalid grade: ${grade}`);
}
