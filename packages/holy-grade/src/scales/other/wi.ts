import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../helpers";

let n = 0;
const gradeMapping: Scale["gradeMapping"] = new Map([
  ["WI0", n++],
  ["WI1", n++],
  ["WI2", n++],
  ["WI3", n++],
  ["WI4", n++],
  ["WI5", n++],
  ["WI6", n++],
  ["WI7", n++],
  ["WI8", n++],
  ["WI9", n++],
  ["WI10", n++],
  ["WI11", n++],
  ["WI12", n++],
  ["WI13", n++],
]);

const normalizer = normalizeFromGradeMappings(gradeMapping);

export const wi: Scale<"WI"> = {
  id: "WI",
  name: "World Ice",
  description: "Waterfall ice rating system as used in the Canadian Rockies.",
  gradeType: "ice",
  gradeMapping,
  numberToGradeTable: buildReverseTable(gradeMapping),
  normalize: (grade) => normalizer(grade.trim().toUpperCase()),
  flags: "🇨🇦",
  osmTagName: "wi",
  usageCount: 0,
};
