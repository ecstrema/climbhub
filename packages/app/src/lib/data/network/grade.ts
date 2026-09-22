import { getScaleFromId, getReference, type ScaleId } from "@climbhub/holy-grade";
import { scaleLinear } from "d3-scale";

// Scale from 0 to 120 (degrees). 50 is 0, 90 is 120. This is a linear scale, but we could use a log scale if we wanted to emphasize the lower grades more.
const scalor = scaleLinear().domain([49, 109]).range([120, -80]).clamp(true);
export function getColorFromGrade(grade: string, scale: ScaleId, dark = false): string {
  let score = getReference(grade, getScaleFromId(scale)!);
  score = score ? scalor(score) : 0;
  return `hsl(${score.toFixed(0)}deg 80% ${dark ? 30 : 70}%)`;
}
