import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../builder";

// Numbers are hand-picked to line up with French (see french.ts): Polish VI- = 61 =
// French 6a, VI.3 = 73 = French 7a, VI.4+ = 81 = French 7c, VI.5+ = 85 = French 8a,
// VI.6+ = 91 = French 8b+, VI.8 = 97 = French 9a.
const gradeMapping: Scale["gradeMapping"] = new Map([
  ["I-", 31],
  ["I", 33],
  ["I+", 35],
  ["II-", 37],
  ["II", 39],
  ["II+", 41],
  ["III-", 43],
  ["III", 45],
  ["III+", 47],
  ["IV-", 49],
  ["IV", 51],
  ["IV+", 53],
  ["V-", 55],
  ["V", 57],
  ["V+", 59],
  ["VI-", 61],
  ["VI", 62],
  ["VI+", 63],
  ["VI.1", 65],
  ["VI.1+", 67],
  ["VI.2", 69],
  ["VI.2+", 71],
  ["VI.3", 73],
  ["VI.3+", 75],
  ["VI.4", 77],
  ["VI.4+", 81],
  ["VI.5", 83],
  ["VI.5+", 85],
  ["VI.6", 89],
  ["VI.6+", 91],
  ["VI.7", 93],
  ["VI.7+", 95],
  ["VI.8", 97],
  ["VI.8+", 99],
  ["VI.9", 103],
  ["VI.9+", 105],
  [">VI.9+", 107],
]);

// Below VI, Polish grades work like UIAA (Roman numerals with -/+); Arabic digits are a
// common alternate spelling for those.
const alternateNames = new Map<string, string>();
["I", "II", "III", "IV", "V"].forEach((numeral, index) => {
  const arabic = index + 1;
  alternateNames.set(`${arabic}-`, `${numeral}-`);
  alternateNames.set(`${arabic}`, numeral);
  alternateNames.set(`${arabic}+`, `${numeral}+`);
});
alternateNames.set("6-", "VI-");
alternateNames.set("6", "VI");
alternateNames.set("6+", "VI+");

const normalizer = normalizeFromGradeMappings(gradeMapping, alternateNames);

export const polish: Scale<"Polish"> = {
  id: "Polish",
  name: "Polish",
  description: "Polish grading system: Roman numerals with +/- up to VI, decimal sub-grades from VI upward.",
  gradeType: "route",
  gradeMapping,
  numberToGradeTable: buildReverseTable(gradeMapping),
  alternateNames,
  normalize: (grade) => normalizer(grade.trim().toUpperCase()),
  usedIn: "Poland",
  flags: "🇵🇱",
  osmTagName: "polish",
  usageCount: 0,
};
