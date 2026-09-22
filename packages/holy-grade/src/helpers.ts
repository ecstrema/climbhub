import type { Scale } from "./scales";

export function convertGrade(grade: string, fromScale: Scale, toScale: Scale): string | undefined {
  if (fromScale === toScale) {
    return grade;
  }

  const reference = getReference(grade, fromScale);
  return reference ? getGradeFromReference(reference, toScale) : undefined;
}

export function getGradeFromReference(reference: number, scale: Scale): string {
  let closestGrade: string | undefined = undefined;
  let closestDifference = Infinity;

  for (const [grade, gradeReference] of scale.gradeMapping.entries()) {
    const difference = Math.abs(reference - gradeReference);
    if (difference < closestDifference) {
      closestDifference = difference;
      closestGrade = grade;
    }
  }
  return closestGrade!;
}

export function getReference(grade: string, scale: Scale): number | undefined {
  const normalizedGrade = scale.normalize(grade);
  return normalizedGrade ? scale.gradeMapping.get(normalizedGrade) : undefined;
}
