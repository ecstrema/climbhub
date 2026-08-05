import type { Scale } from "./scales";

export function convertGrade(grade: string, fromScale: Scale, toScale: Scale): string {
  if (fromScale === toScale) {
    return grade;
  }

  const reference = getReference(grade, fromScale);

  // choose the closest grade in the target scale
  let closestGrade: string | null = null;
  let closestDifference = Infinity;

  for (const [targetGrade, targetReference] of Object.entries(toScale.gradeMapping)) {
    const difference = Math.abs(reference - targetReference);
    if (difference < closestDifference) {
      closestDifference = difference;
      closestGrade = targetGrade;
    }
  }

  return closestGrade!;
}

export function getReference(grade: string, scale: Scale): number {
  const normalizedGrade = scale.normalize(grade);
  return scale.gradeMapping[normalizedGrade];
}
