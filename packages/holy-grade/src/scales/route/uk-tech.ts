import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../builder";

// Numbers are hand-picked to line up with French (see french.ts): UKTech 5b = 63 =
// French 6a+, 5c = 67 = French 6b+, 6a = 73 = French 7a, 6b = 77 = French 7b,
// 6c = 83 = French 7c+, 7a = 87 = French 8a+, 7b = 93 = French 8c.
const gradeMapping: Scale["gradeMapping"] = new Map([
  ["1", 5],
  ["2", 17],
  ["3", 29],
  ["4a", 41],
  ["4a/4b", 43],
  ["4b", 45],
  ["4b/4c", 47],
  ["4c", 49],
  ["4c/5a", 51],
  ["5a", 57],
  ["5a/5b", 59],
  ["5b", 63],
  ["5b/5c", 65],
  ["5c", 67],
  ["5c/6a", 70],
  ["6a", 73],
  ["6a/6b", 75],
  ["6b", 77],
  ["6b/6c", 80],
  ["6c", 83],
  ["6c/7a", 85],
  ["7a", 87],
  ["7a/7b", 89],
  ["7b", 93],
  [">7b", 97],
]);

const normalizer = normalizeFromGradeMappings(gradeMapping);

export const ukTech: Scale<"UKTech"> = {
  id: "UKTech",
  name: "UK Technical",
  description: "The British technical grading system for traditional climbs, paired with the UK Adjectival grade.",
  gradeType: "route",
  gradeMapping,
  numberToGradeTable: buildReverseTable(gradeMapping),
  normalize: (grade) => normalizer(grade.trim().toLowerCase()),
  nameAlt: "British Traditional",
  usedIn: "UK",
  flags: "🇬🇧",
  osmTagName: "british_traditional",
  usageCount: 0,
};
