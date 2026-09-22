import type { GradeMapping, NormalizationGradeMapping } from "./types";

export function normalizeFromGradeMappings(
  gradeMapping: GradeMapping,
  extendedGradeNormalizationMapping?: NormalizationGradeMapping,
) {
  return (grade: string): string | undefined => {
    if (gradeMapping.has(grade)) {
      return grade;
    }

    if (extendedGradeNormalizationMapping && extendedGradeNormalizationMapping.get(grade)) {
      return extendedGradeNormalizationMapping.get(grade);
    }
  };
}
