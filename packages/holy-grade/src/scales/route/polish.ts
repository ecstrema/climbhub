import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../helpers";

const gradeMapping: Scale["gradeMapping"] = new Map([
  ["I-", 0],
  ["I", 3],
  ["I+", 6],
  ["II-", 9],
  ["II", 11],
  ["II+", 14],
  ["III-", 17],
  ["III", 20],
  ["III+", 23],
  ["IV-", 26],
  ["IV", 29],
  ["IV+", 31],
  ["V-", 34],
  ["V", 37],
  ["V+", 40],
  ["VI-", 43],
  ["VI", 46],
  ["VI.1", 49],
  ["VI.1+", 51],
  ["VI.2", 54],
  ["VI.2+", 57],
  ["VI.3", 60],
  ["VI.3+", 63],
  ["VI.4", 66],
  ["VI.4+", 69],
  ["VI.5", 71],
  ["VI.5+", 74],
  ["VI.6", 77],
  ["VI.6+", 80],
  ["VI.7", 83],
  ["VI.7+", 86],
  ["VI.8", 89],
  ["VI.8+", 91],
  ["VI.9", 94],
  ["VI.9+", 97],
  [">VI.9+", 100],
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
