import { allScales, getReference } from "@climbhub/holy-grade";

/** Converts a grade typed in any scale, like "6a+" or "V4", to its reference number. */
export function gradeTextToReference(text: string): number | undefined {
  const grade = text.trim();
  if (!grade) return;
  for (const scale of allScales) {
    const reference = getReference(grade, scale);
    if (reference !== undefined) return reference;
  }
}
