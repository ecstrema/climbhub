import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../builder";

const gradeMapping: Scale["gradeMapping"] = new Map();
for (let n = 1; n < 14; n++) {
  gradeMapping.set(`WI${n}`, 2 * n - 1)
  gradeMapping.set(`WI${n}/${n+1}`, 2 * n)
}

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
