import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../helpers";

// Numbers are hand-picked to line up with Fontainebleau (see fb.ts): Hueco V9 = 25 = FB 7C,
// Hueco V15 = 32 = FB 8C.
const gradeMapping: Scale["gradeMapping"] = new Map([
  ["VB-", 6],
  ["VB", 7],
  ["VB/V0-", 8],
  ["V0-", 9],
  ["V0-/V0", 10],
  ["V0", 11],
  ["V0+", 12],
  ["V1", 13],
  ["V1/V2", 14],
  ["V2", 15],
  ["V3", 16],
  ["V3/V4", 17],
  ["V4", 18],
  ["V4/V5", 19],
  ["V5", 20],
  ["V6", 21],
  ["V6/V7", 22],
  ["V7", 23],
  ["V8", 24],
  ["V9", 25],
  ["V10", 26],
  ["V10/V11", 27],
  ["V11", 28],
  ["V12", 29],
  ["V13", 30],
  ["V14", 31],
  ["V15", 32],
  ["V16", 33],
  ["V17", 34],
  ["V18", 35],
]);

const normalizer = normalizeFromGradeMappings(gradeMapping);

export const hueco: Scale<"Hueco"> = {
  id: "Hueco",
  name: "V Grade",
  description:
    'The V scale grading system, created by John Sherman, is the most widely used bouldering scale in North America. Also known as "Hueco".',
  gradeType: "boulder",
  gradeMapping,
  numberToGradeTable: buildReverseTable(gradeMapping),
  normalize: (grade) => normalizer(grade.trim().toUpperCase()),
  nameAlt: "Hueco",
  usedIn: "North America",
  flags: "🇺🇸🇨🇦",
  osmTagName: "hueco",
  usageCount: 0,
};
