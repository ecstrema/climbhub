export type GradeMapping = Record<string, number>;

export type GradeType = "route" | "boulder" | "ice";

export interface Scale<T extends ScaleId = ScaleId> {
  /** Can also be used as a shorter name alternative */
  id: T;
  name: string;
  description: string;
  gradeMapping: GradeMapping;
  gradeType: GradeType;
  normalize: (grade: string) => string | undefined;
  extendedGradeNormalizationMapping?: Record<string, string>;
}

export type RouteScaleId = "UIAA" | "French" | "YDS";
export type BoulderScaleId = "Hueco" | "FB";
export type IceScaleId = "WI";
export type ScaleId = RouteScaleId | BoulderScaleId | IceScaleId;
