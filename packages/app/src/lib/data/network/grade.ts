import { getScale, getReference, type ScaleId, DIFFICULTY_RANGE } from "@climbhub/holy-grade";
import { scaleLinear } from "d3-scale";

// Scale from 0 to 120 (degrees). 50 is 0, 90 is 120. This is a linear scale, but we could use a log scale if we wanted to emphasize the lower grades more.
const scalor = scaleLinear([120, -80]).clamp(true);
export function getColorFromGrade(grade: string, scaleId: ScaleId, dark = false): string {
  const scale = getScale(scaleId);
  if (!scale) {
    console.warn(`Scale ${scale} not found`);
    return dark ? "hsl(0deg 0% 30%)" : "hsl(0deg 0% 70%)";
  }
  let score = getReference(grade, scale);
  const difficultyRange = DIFFICULTY_RANGE[scale.gradeType];
  score = score ? scalor.domain([difficultyRange.beginner, difficultyRange.pro])(score) : 0;
  return `hsl(${score.toFixed(0)}deg 80% ${dark ? 30 : 70}%)`;
}
