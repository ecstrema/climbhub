import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../builder";

// A single, unbroken number line (no letters, no +/-) — unlike most other route scales.
// Calibrated to align with French (see french.ts): Ewbank 18 = 61 = French 6a,
// Ewbank 22 = 73 = French 7a, Ewbank 27 = 81 = French 7c, Ewbank 32 = 91 = French 8b+ (Punks in the Gym),
// Ewbank 35 = 97 = French 9a.
const gradeMapping: Scale["gradeMapping"] = new Map([
  ["1", 3],
  ["2", 5],
  ["3", 7],
  ["4", 9],
  ["5", 15],
  ["6", 17],
  ["7", 21],
  ["8", 27],
  ["9", 29],
  ["10", 37],
  ["11", 39],
  ["12", 41],
  ["13", 45],
  ["14", 47],
  ["15", 49],
  ["16", 53],
  ["17", 57],
  ["18", 61],
  ["19", 64],
  ["20", 67],
  ["21", 70],
  ["22", 73],
  ["23", 74],
  ["24", 75],
  ["25", 77],
  ["26", 79],
  ["27", 81],
  ["28", 83],
  ["29", 85],
  ["30", 87],
  ["31", 89],
  ["32", 91],
  ["33", 93],
  ["34", 95],
  ["35", 97],
  ["36", 99],
  ["37", 101],
  ["38", 103],
  ["39", 105],
]);

const normalizer = normalizeFromGradeMappings(gradeMapping);

export const ewbank: Scale<"Ewbank"> = {
  id: "Ewbank",
  name: "Ewbank",
  description:
    "A single open-ended numerical scale (no letters) used to rate both the technical difficulty and overall seriousness of a route, all in one number.",
  gradeType: "route",
  gradeMapping,
  numberToGradeTable: buildReverseTable(gradeMapping),
  normalize: (grade) => normalizer(grade.trim()),
  usedIn: "Australia and New Zealand",
  flags: "🇦🇺🇳🇿",
  osmTagName: "ewbank",
  usageCount: 0,
};
