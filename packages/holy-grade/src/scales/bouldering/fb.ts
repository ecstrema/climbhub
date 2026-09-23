import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../helpers";

// Fontainebleau bouldering grades are written UPPERCASE ("7A", "6B+"), unlike French route
// grades which are lowercase ("7a") — this is the one thing that got lost when this scale
// was first ported from a spreadsheet.
//
// Numbers are hand-picked to line up with Hueco (see hueco.ts): FB 7C = 25 = Hueco V9,
// FB 8C = 32 = Hueco V15.
const gradeMapping: Scale["gradeMapping"] = new Map([
  ["2-", 0],
  ["2", 1],
  ["2+", 2],
  ["3-", 3],
  ["3", 4],
  ["3+", 5],
  ["4", 6],
  ["4+", 7],
  ["5-", 8],
  ["5", 9],
  ["5+", 10],
  ["5+/6A", 11],
  ["6A", 12],
  ["6A+", 13],
  ["6A+/6B", 14],
  ["6B", 15],
  ["6B+", 16],
  ["6B/6C", 17],
  ["6C", 18],
  ["6C+", 19],
  ["7A", 20],
  ["7A/7A+", 21],
  ["7A+", 22],
  ["7B", 23],
  ["7B+", 24],
  ["7C", 25],
  ["7C+", 26],
  ["7C+/8A", 27],
  ["8A", 28],
  ["8A+", 29],
  ["8B", 30],
  ["8B+", 31],
  ["8C", 32],
  ["8C+", 33],
  ["9A", 34],
  ["9A+", 35],
]);

const normalizer = normalizeFromGradeMappings(gradeMapping);

export const fb: Scale<"FB"> = {
  id: "FB",
  name: "Fontainebleau",
  description:
    'The French numerical bouldering scale, born in the Fontainebleau forest. Written uppercase (e.g. "7A"), unlike the French route scale\'s lowercase ("7a").',
  gradeType: "boulder",
  gradeMapping,
  numberToGradeTable: buildReverseTable(gradeMapping),
  normalize: (grade) => normalizer(grade.trim().toUpperCase()),
  usedIn: "Everywhere except North America",
  flags: "🇪🇺🇫🇷",
  osmTagName: "fb",
  usageCount: 0,
};
