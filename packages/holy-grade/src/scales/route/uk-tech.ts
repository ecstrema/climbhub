import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../builder";

// Numbers are hand-picked to line up with French (see french.ts): UKTech 5b = 63 =
// French 6a+, 5c = 67 = French 6b+, 6a = 73 = French 7a, 6b = 77 = French 7b,
// 6c = 83 = French 7c+, 7a = 87 = French 8a+, 7b = 93 = French 8c.
const gradeMapping: Scale["gradeMapping"] = new Map([
  ["1", 5],
  ["1/2", 11],
  ["2", 17],
  ["2/3", 23],
  ["3", 29],
  ["3/4a", 35],
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
  ["5c/6a", 71],
  ["6a", 75],
  ["6a/6b", 77],
  ["6b", 79],
  ["6b/6c", 82],
  ["6c", 85],
  ["6c/7a", 87],
  ["7a", 89],
  ["7a/7b", 91],
  ["7b", 95],
  ["7b/>7b", 97],
  [">7b", 99],
]);

const alternateNames = new Map<string, string>([
  ["4a/b", "4a/4b"],
  ["4b/c", "4b/4c"],
  ["5a/b", "5a/5b"],
  ["5b/c", "5b/5c"],
  ["6a/b", "6a/6b"],
  ["6b/c", "6b/6c"],
  ["7a/b", "7a/7b"],
]);

const normalizer = normalizeFromGradeMappings(gradeMapping, alternateNames);

export const ukTech: Scale<"UKTech"> = {
  id: "UKTech",
  name: "UK Technical",
  description: "The British technical grading system for traditional climbs, paired with the UK Adjectival grade.",
  gradeType: "route",
  gradeMapping,
  numberToGradeTable: buildReverseTable(gradeMapping),
  alternateNames,
  normalize: (grade) => normalizer(grade.trim().toLowerCase()),
  nameAlt: "British Traditional",
  usedIn: "UK",
  flags: "🇬🇧",
  osmTagName: "british_traditional",
  usageCount: 0,
};
