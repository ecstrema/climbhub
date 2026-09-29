import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings, numeralAlternateNames } from "../builder";

// Numbers are hand-picked to loosely line up with French (see french.ts): Saxon VIIb = 60 ~
// French 6a, Saxon IXa = 72 ~ French 7a. Best-effort placement on a commonly-cited
// comparison chart — less rigorously verified than French<->YDS, see grading.test.ts.
const gradeMapping: Scale["gradeMapping"] = new Map([
  ["I", 53],
  ["II", 54],
  ["III", 55],
  ["IV", 56],
  ["V", 57],
  ["VI", 58],
  ["VIIa", 59],
  ["VIIb", 60],
  ["VII", 61],
  ["VIIc", 62],
  ["VIIc/VIIIa", 63],
  ["VIII", 64],
  ["VIIIa", 65],
  ["VIIIa/VIIIb", 67],
  ["VIIIb", 68],
  ["VIIIb/VIIIc", 69],
  ["VIIIc", 70],
  ["VIIIc/IXa", 71],
  ["IXa", 72],
  ["IXa/IXb", 73],
  ["IXb", 74],
  ["IXb/IXc", 75],
  ["IXc", 76],
  ["IXc/Xa", 77],
  ["Xa", 78],
  ["Xa/Xb", 79],
  ["Xb", 80],
  ["Xb/Xc", 81],
  ["Xc", 82],
  ["Xc/XIa", 83],
  ["XIa", 84],
  ["XIa/XIb", 85],
  ["XIb", 86],
  ["XIb/XIc", 87],
  ["XIc", 88],
  ["XIc/XIIa", 89],
  ["XIIa", 90],
  ["XIIa/XIIb", 91],
  ["XIIb", 92],
  ["XIIb/XIIc", 93],
  ["XIIc", 94],
  ["XIIIa", 95],
  ["XIIIa/XIIIb", 96],
  ["XIIIb", 97],
  ["XIIIb/XIIIc", 98],
  ["XIIIc", 99],
  [">XIIIc", 100],
]);

// Saxon's canonical form is Roman numerals with no +/-, so its Arabic alternates are just the
// plain whole numbers (1..13), not the "-"/"+" triplets numeralAlternateNames also produces —
// filter those out.
const alternateNames = new Map(
  [...numeralAlternateNames(13, false)].filter(([key]) => !key.endsWith("-") && !key.endsWith("+")),
);

const normalizer = normalizeFromGradeMappings(gradeMapping, alternateNames);

export const saxon: Scale<"Saxon"> = {
  id: "Saxon",
  name: "Saxon",
  description:
    "The Saxon grading system was developed in the beginning of the 20th century for the formidable Saxon Switzerland climbing region.",
  gradeType: "route",
  gradeMapping,
  numberToGradeTable: buildReverseTable(gradeMapping),
  alternateNames,
  normalize: (grade) => normalizer(grade.trim().toUpperCase()),
  nameAlt: "Swiss",
  usedIn: "Switzerland",
  flags: "🇩🇪🇨🇿",
  osmTagName: "saxon",
  usageCount: 0,
};
