import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../builder";

// A single, unbroken number line (no letters, no +/-) — unlike most other route scales.
// Numbers are hand-picked to loosely line up with French (see french.ts): Ewbank 18 = 60 ~
// French 6a, Ewbank 22 = 72 ~ French 7a. Best-effort placement on a commonly-cited comparison
// chart — less rigorously verified than French<->YDS, see grading.test.ts.
const gradeMapping: Scale["gradeMapping"] = new Map([
  ["1", 43],
  ["2", 44],
  ["3", 45],
  ["4", 46],
  ["5", 47],
  ["6", 48],
  ["7", 49],
  ["8", 50],
  ["9", 51],
  ["10", 52],
  ["11", 53],
  ["12", 54],
  ["13", 55],
  ["14", 56],
  ["15", 57],
  ["16", 58],
  ["17", 59],
  ["18", 60],
  ["19", 63],
  ["20", 66],
  ["21", 69],
  ["22", 72],
  ["23", 73],
  ["24", 74],
  ["25", 75],
  ["26", 76],
  ["27", 77],
  ["28", 78],
  ["29", 79],
  ["30", 80],
  ["31", 81],
  ["32", 82],
  ["33", 83],
  ["34", 84],
  ["35", 85],
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
