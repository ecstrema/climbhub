import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../builder";

const gradeMapping: Scale["gradeMapping"] = new Map([
  ["1", 0],
  ["1/2", 3],
  ["2", 7],
  ["2/3", 10],
  ["3", 13],
  ["4a", 17],
  ["4a/4b", 20],
  ["4b", 23],
  ["4c", 27],
  ["5a", 30],
  ["5b", 33],
  ["5c", 37],
  ["6a", 40],
  ["6b", 43],
  ["6b+", 47],
  ["6c", 50],
  ["6c+", 53],
  ["7a", 57],
  ["7a+", 60],
  ["7a+/7b", 63],
  ["7b", 67],
  ["7b+", 70],
  ["7c", 73],
  ["7c+", 77],
  ["7c+/8a", 80],
  ["8a", 83],
  ["8a+/8b", 87],
  ["8b", 90],
  ["8b+", 93],
  ["8c", 97],
  ["8c+", 100],
]);

const normalizer = normalizeFromGradeMappings(gradeMapping);

export const frenchBritish: Scale<"FrenchBritish"> = {
  id: "FrenchBritish",
  name: "French British",
  description: "Sport climbing in Britain and Ireland uses the French grading system.",
  gradeType: "route",
  gradeMapping,
  numberToGradeTable: buildReverseTable(gradeMapping),
  normalize: (grade) => normalizer(grade.trim().toLowerCase()),
  flags: "🇬🇧🇮🇪",
  osmTagName: "french_british",
  usageCount: 0,
};
