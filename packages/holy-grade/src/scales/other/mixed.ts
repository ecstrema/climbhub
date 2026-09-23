import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../helpers";

let n = 0;
const gradeMapping: Scale["gradeMapping"] = new Map([
  ["M0", n++],
  ["M1", n++],
  ["M2", n++],
  ["M3", n++],
  ["M4", n++],
  ["M5", n++],
  ["M6", n++],
  ["M7", n++],
  ["M8", n++],
  ["M9", n++],
  ["M10", n++],
  ["M11", n++],
  ["M12", n++],
  ["M13", n++],
]);

const normalizer = normalizeFromGradeMappings(gradeMapping);

export const mixed: Scale<"Mixed"> = {
  id: "Mixed",
  name: "Mixed",
  description: "Mixed climbing has its own grading scale that roughly follows the WI rating system.",
  gradeType: "ice",
  gradeMapping,
  numberToGradeTable: buildReverseTable(gradeMapping),
  normalize: (grade) => normalizer(grade.trim().toUpperCase()),
  flags: "🇨🇦",
  osmTagName: "mixed",
  usageCount: 0,
};
