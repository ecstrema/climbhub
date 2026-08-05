import type { GradeMapping, Scale, GradeType } from "../types";
import * as Self from "./fb";

const _typecheck: Scale = Self;

export const nameShort = "FB";
export const nameLong = "Fontainebleau";
export const description =
  "The Fontainebleau scale is a bouldering grading system that originated in the Fontainebleau forest in France. It is widely used in Europe and has become a standard for bouldering grades worldwide. The FB acronym can stand for Fontainebleau, French-British, or French-Bouldering.";

export const gradeType: GradeType = "boulder";

type Qualifiers = "A" | "B" | "C" | "A+" | "B+" | "C+";
export type Grades =
  | `${1 | 2 | 3 | 4 | 5}${Qualifiers | ""}`
  | `${6 | 7 | 8 | 9}${Qualifiers}`
  | "10A";

export const gradeMapping: GradeMapping<Grades> = {
  "1": 1,
  "1A": 1.5,
  "1A+": 3,
  "1B": 4,
  "1B+": 5,
  "1C": 6,
  "1C+": 6.5,
  "2": 7.5,
  "2A": 7.5,
  "2A+": 8.5,
  "2B": 9.5,
  "2B+": 10.5,
  "2C": 11.5,
  "2C+": 12.5,
  "3": 14,
  "3A": 14,
  "3A+": 15,
  "3B": 16,
  "3B+": 17,
  "3C": 18,
  "3C+": 19,
  "4": 20.5,
  "4A": 20.5,
  "4A+": 26.5,
  "4B": 27,
  "4B+": 33,
  "4C": 33.5,
  "4C+": 39.5,
  "5": 40,
  "5A": 40,
  "5A+": 46.5,
  "5B": 47,
  "5B+": 53,
  "5C": 54,
  "5C+": 59,
  "6A": 60,
  "6A+": 61,
  "6B": 62.5,
  "6B+": 64.5,
  "6C": 66.5,
  "6C+": 68.5,
  "7A": 70.5,
  "7A+": 72.5,
  "7B": 74,
  "7B+": 75.5,
  "7C": 77.5,
  "7C+": 79.5,
  "8A": 81.5,
  "8A+": 83.5,
  "8B": 85.5,
  "8B+": 87,
  "8C": 88.5,
  "8C+": 90.5,
  "9A": 92.5,
  "9A+": 94.5,
  "9B": 96.5,
  "9B+": 98.5,
  "9C": 100,
  "9C+": 102,
  "10A": 104,
};

export function normalize(grade: string): Grades {
  const upperedGrade = grade.toUpperCase();
  if (upperedGrade in gradeMapping) {
    return upperedGrade as Grades;
  }

  throw new Error(`Invalid grade: ${grade}`);
}
