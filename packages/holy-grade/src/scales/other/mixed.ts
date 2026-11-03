import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../builder";

const gradeMapping: Scale["gradeMapping"] = new Map();
for (let n = 1; n < 14; n++) {
  gradeMapping.set(`M${n}`, 2 * n - 1);
  gradeMapping.set(`M${n}/${n + 1}`, 2 * n);
}

const alternateNames = new Map<string, string>();
for (let n = 1; n < 13; n++) {
  alternateNames.set(`M${n}/M${n + 1}`, `M${n}/${n + 1}`);
}

const normalizer = normalizeFromGradeMappings(gradeMapping, alternateNames);

export const mixed: Scale<"Mixed"> = {
  id: "Mixed",
  name: "Mixed",
  description: "Mixed climbing has its own grading scale that roughly follows the WI rating system.",
  gradeType: "ice",
  gradeMapping,
  numberToGradeTable: buildReverseTable(gradeMapping),
  alternateNames,
  normalize: (grade) => normalizer(grade.trim().toUpperCase()),
  flags: "🇨🇦",
  osmTagName: "mixed",
  usageCount: 0,
};
