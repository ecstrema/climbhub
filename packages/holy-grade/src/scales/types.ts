export type GradeMapping<T extends string = string> = Record<T, number>;

export type GradeType = "route" | "boulder";

export interface Scale<StandardizedGrade extends string = string> {
  nameShort: string;
  nameLong: string;
  description: string;
  gradeMapping: GradeMapping<StandardizedGrade>;
  gradeType: GradeType;
  normalize: (grade: string) => StandardizedGrade;
  extendedGradeNormalizationMapping?: Record<string, StandardizedGrade>;
}

export type ScaleName = keyof typeof import("./index");
