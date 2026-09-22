export type GradeMapping = Map<string, number>;
export type NormalizationGradeMapping = Map<string, string>;

export type GradeType = "route" | "boulder" | "ice";

export interface Scale<T extends ScaleId = ScaleId> {
  /** Can also be used as a shorter name alternative */
  id: T;
  name: string;
  description: string;
  /** The grade mapping is ordered, so it doesn't have to be sorted. */
  gradeMapping: GradeMapping;
  gradeType: GradeType;
  normalize: (grade: string) => string | undefined;
  extendedGradeNormalizationMapping?: Map<string, string>;
}

export type RouteScaleId = "UIAA" | "French" | "YDS" | "Saxon";
export type BoulderScaleId = "Hueco" | "FB";
export type IceScaleId = "WI";
export type ScaleId = RouteScaleId | BoulderScaleId | IceScaleId;
