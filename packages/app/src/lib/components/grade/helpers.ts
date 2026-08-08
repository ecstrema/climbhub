import type { Grade } from "$lib/osm-tags";
import { allScalesMap, getReference } from "holy-grade";
import { scaleLinear } from "d3-scale";

// Scale from 0 to 120 (degrees). 50 is 0, 90 is 120. This is a linear scale, but we could use a log scale if we wanted to emphasize the lower grades more.
const scale = scaleLinear().domain([49, 109]).range([120, -80]).clamp(true);
export function getColorFromGrade(grade: Grade, dark = false): string {
  let score = getReference(grade.v, allScalesMap[grade.scale]);
  score = scale(score);
  return `hsl(${score.toFixed(0)}deg 80% ${dark ? 30 : 70}%)`;
}
