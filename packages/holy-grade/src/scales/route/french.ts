import type { GradeMapping, Scale, GradeType } from "../types";
import * as Self from "./french";

const _typecheck: Scale = Self;

export const nameShort = "French";
export const nameLong = "French Scale";
export const description = "Now the most common scale in the world, born in France.";

export const gradeType: GradeType = "route";

type Qualifiers = "a" | "b" | "c" | "a+" | "b+" | "c+" | "a/+" | "a+/b" | "b/+" | "b+/c" | "c/+";
type Units = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Grades =
  | `${Units}${Qualifiers}`
  | "10a"
  | "1c+/2a"
  | "2c+/3a"
  | "3c+/4a"
  | "4c+/5a"
  | "5c+/6a"
  | "6c+/7a"
  | "7c+/8a"
  | "8c+/9a"
  | "9c+/10a";

// @ts-ignore
export const gradeMapping: GradeMapping<Grades> = {};
const variantsPerNumber: Qualifiers[] = [
  "a",
  "a/+",
  "a+",
  "a+/b",
  "b",
  "b/+",
  "b+",
  "b+/c",
  "c",
  "c/+",
  "c+",
];
for (let n: Units = 1; n <= 9; n++) {
  for (let qualifierIndex = 0; qualifierIndex < variantsPerNumber.length; qualifierIndex++) {
    const qualifier = variantsPerNumber[qualifierIndex];
    const grade = `${n}${qualifier}` as Grades;
    gradeMapping[grade] = (n - 1) * (variantsPerNumber.length + 1) + qualifierIndex + 1;
  }
  const transitionGrade = `${n}c+/${n + 1}a` as Grades;
  gradeMapping[transitionGrade] =
    (n - 1) * (variantsPerNumber.length + 1) + variantsPerNumber.length + 1;
}
gradeMapping["10a"] = 9 * (variantsPerNumber.length + 1) + 1;

export type ExtendedGrades =
  | "1-"
  | "1"
  | "1+"
  | "2-"
  | "2"
  | "2+"
  | "3-"
  | "3"
  | "3+"
  | "4-"
  | "4"
  | "4+"
  | "5-"
  | "5"
  | "5+";

export const extendedGradeNormalizationMapping: Record<ExtendedGrades, Grades> = {
  "1-": "1a",
  "1": "1b",
  "1+": "1c",
  "2-": "2a",
  "2": "2b",
  "2+": "2c",
  "3-": "3a",
  "3": "3b",
  "3+": "3c",
  "4-": "4a",
  "4": "4b",
  "4+": "4c",
  "5-": "5a",
  "5": "5b",
  "5+": "5c",
};

export function normalize(grade: string): Grades {
  const loweredGrade = grade.toLowerCase();
  if (loweredGrade in gradeMapping) {
    return loweredGrade as Grades;
  }

  if (loweredGrade in extendedGradeNormalizationMapping) {
    return extendedGradeNormalizationMapping[loweredGrade as ExtendedGrades];
  }

  throw new Error(`Invalid grade: ${grade}`);
}
