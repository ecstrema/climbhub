import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../builder";

// Numbers are hand-picked to line up with Fontainebleau (see fb.ts): Hueco V9 = 25 = FB 7C,
// Hueco V15 = 32 = FB 8C.
const gradeMapping: Scale["gradeMapping"] = new Map([
  ["VB-", 1],
  ["VB", 13],
  ["VB/V0-", 21],
  ["V0-", 25],
  ["V0-/V0", 33],
  ["V0", 37],
  ["V0/V0+", 41],
  ["V0+", 45],
  ["V0+/V1", 47],
  ["V1", 49],
  ["V1/2", 53],
  ["V2", 57],
  ["V2/3", 59],
  ["V3", 61],
  ["V3/4", 63],
  ["V4", 65],
  ["V4/5", 67],
  ["V5", 69],
  ["V5/6", 71],
  ["V6", 73],
  ["V6/7", 75],
  ["V7", 77],
  ["V7/8", 78],
  ["V8", 79],
  ["V8/9", 80],
  ["V9", 81],
  ["V9/10", 82],
  ["V10", 83],
  ["V10/11", 84],
  ["V11", 85],
  ["V11/12", 86],
  ["V12", 87],
  ["V12/13", 88],
  ["V13", 89],
  ["V13/14", 90],
  ["V14", 91],
  ["V14/15", 92],
  ["V15", 93],
  ["V15/16", 94],
  ["V16", 95],
  ["V16/17", 96],
  ["V17", 97],
  ["V17/18", 98],
  ["V18", 99],
]);

const alternateNames = new Map<string, string>([
  ["V0/V1", "V0+/V1"],
  ["VB/V0", "VB/V0-"],
]);
for (let n = 1; n < 18; n++) {
  alternateNames.set(`V${n}/V${n + 1}`, `V${n}/${n + 1}`);
}

const normalizer = normalizeFromGradeMappings(gradeMapping, alternateNames);

export const hueco: Scale<"Hueco"> = {
  id: "Hueco",
  name: "V Grade",
  description:
    'The V scale grading system, created by John Sherman, is the most widely used bouldering scale in North America. Also known as "Hueco".',
  gradeType: "boulder",
  gradeMapping,
  numberToGradeTable: buildReverseTable(gradeMapping),
  alternateNames,
  normalize: (grade) => normalizer(grade.trim().toUpperCase()),
  nameAlt: "Hueco",
  usedIn: "North America",
  flags: "🇺🇸🇨🇦",
  osmTagName: "hueco",
  usageCount: 0,
};
