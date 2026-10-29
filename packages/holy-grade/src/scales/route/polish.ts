import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../builder";

// Numbers are hand-picked to line up with French (see french.ts): Polish VI- = 61 =
// French 6a, VI.3 = 73 = French 7a, VI.4+ = 81 = French 7c, VI.5+ = 85 = French 8a,
// VI.6+ = 91 = French 8b+, VI.8 = 97 = French 9a.
const gradeMapping: Scale["gradeMapping"] = new Map([
  ["I-", 31],
  ["I-/I", 32],
  ["I", 33],
  ["I/I+", 34],
  ["I+", 35],
  ["I+/II-", 36],
  ["II-", 37],
  ["II-/II", 38],
  ["II", 39],
  ["II/II+", 40],
  ["II+", 41],
  ["II+/III-", 42],
  ["III-", 43],
  ["III-/III", 44],
  ["III", 45],
  ["III/III+", 46],
  ["III+", 47],
  ["III+/IV-", 48],
  ["IV-", 49],
  ["IV-/IV", 50],
  ["IV", 51],
  ["IV/IV+", 52],
  ["IV+", 53],
  ["IV+/V-", 54],
  ["V-", 55],
  ["V-/V", 56],
  ["V", 57],
  ["V/V+", 58],
  ["V+", 59],
  ["V+/VI-", 60],
  ["VI-", 61],
  ["VI", 62],
  ["VI+", 63],
  ["VI+/VI.1", 64],
  ["VI.1", 65],
  ["VI.1/VI.1+", 66],
  ["VI.1+", 67],
  ["VI.1+/VI.2", 68],
  ["VI.2", 69],
  ["VI.2/VI.2+", 70],
  ["VI.2+", 72],
  ["VI.2+/VI.3", 73],
  ["VI.3", 75],
  ["VI.3/VI.3+", 76],
  ["VI.3+", 77],
  ["VI.3+/VI.4", 78],
  ["VI.4", 79],
  ["VI.4/VI.4+", 81],
  ["VI.4+", 83],
  ["VI.4+/VI.5", 84],
  ["VI.5", 85],
  ["VI.5/VI.5+", 86],
  ["VI.5+", 87],
  ["VI.5+/VI.6", 89],
  ["VI.6", 91],
  ["VI.6/VI.6+", 92],
  ["VI.6+", 93],
  ["VI.6+/VI.7", 94],
  ["VI.7", 95],
  ["VI.7/VI.7+", 96],
  ["VI.7+", 97],
  ["VI.7+/VI.8", 98],
  ["VI.8", 99],
  ["VI.8/VI.8+", 100],
  ["VI.8+", 101],
  ["VI.8+/VI.9", 103],
  ["VI.9", 105],
  ["VI.9/VI.9+", 106],
  ["VI.9+", 107],
  ["VI.9+/>VI.9+", 108],
  [">VI.9+", 109],
]);

// Below VI, Polish grades work like UIAA (Roman numerals with -/+); Arabic digits are a
// common alternate spelling for those.
const alternateNames = new Map<string, string>();
["I", "II", "III", "IV", "V"].forEach((numeral, index) => {
  const arabic = index + 1;
  alternateNames.set(`${arabic}-`, `${numeral}-`);
  alternateNames.set(`${arabic}-/${arabic}`, `${numeral}-/${numeral}`);
  alternateNames.set(`${arabic}`, numeral);
  alternateNames.set(`${arabic}/${arabic}+`, `${numeral}/${numeral}+`);
  alternateNames.set(`${arabic}+`, `${numeral}+`);
  if (index < 4) {
    const nextArabic = index + 2;
    const nextNumeral = ["I", "II", "III", "IV", "V"][index + 1];
    alternateNames.set(`${arabic}+/${nextArabic}-`, `${numeral}+/${nextNumeral}-`);
  }
});
alternateNames.set("5+/6-", "V+/VI-");
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
