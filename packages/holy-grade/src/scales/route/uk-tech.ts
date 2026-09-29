import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../builder";

const gradeMapping: Scale["gradeMapping"] = new Map([
  ["1", 0],
  ["2", 5],
  ["3", 9],
  ["4a", 14],
  ["4a/4b", 18],
  ["4b", 23],
  ["4c", 27],
  ["4c/5a", 32],
  ["5a", 36],
  ["5a/5b", 41],
  ["5b", 45],
  ["5b/5c", 50],
  ["5c", 55],
  ["5c/6a", 59],
  ["6a", 64],
  ["6b", 68],
  ["6b/6c", 73],
  ["6c", 77],
  ["6c/7a", 82],
  ["7a", 86],
  ["7a/7b", 91],
  ["7b", 95],
  [">7b", 100],
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
