import type { Grade } from "$lib/osm-tags";
import { allScalesMap, getReference } from "holy-grade";

export function getColorFromGrade(grade: Grade, dark = false): string {
  let score = getReference(grade.v, allScalesMap[grade.scale]);
  score = 120 - (score / 100) * 120;

  return `hsl(${score.toFixed(0)}deg 80% ${dark ? 30 : 70}%)`;
}
