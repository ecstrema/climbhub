export function normalizeFromGradeMappings(
  gradeMapping: Record<string, number>,
  extendedGradeNormalizationMapping?: Record<string, string>,
) {
  return (grade: string): string | null => {
    if (grade in gradeMapping) {
      return grade;
    }

    if (extendedGradeNormalizationMapping && grade in extendedGradeNormalizationMapping) {
      return extendedGradeNormalizationMapping[grade];
    }

    return null;
  };
}
