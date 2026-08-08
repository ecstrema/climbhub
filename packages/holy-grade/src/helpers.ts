import type { Scale } from "./scales";

export function convertGrade(grade: string, fromScale: Scale, toScale: Scale): string | null {
  if (fromScale === toScale) {
    return grade;
  }

  const reference = getReference(grade, fromScale);
  return reference ? getGradeFromReference(reference, toScale) : null;
}

export function getGradeFromReference(reference: number, scale: Scale): string {
  let closestGrade: string | null = null;
  let closestDifference = Infinity;

  for (const [grade, gradeReference] of Object.entries(scale.gradeMapping)) {
    const difference = Math.abs(reference - gradeReference);
    if (difference < closestDifference) {
      closestDifference = difference;
      closestGrade = grade;
    }
  }
  return closestGrade!;
}

export function getReference(grade: string, scale: Scale): number | null {
  const normalizedGrade = scale.normalize(grade);
  return normalizedGrade ? scale.gradeMapping[normalizedGrade] : null;
}
