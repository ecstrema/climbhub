import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../helpers";

// Numbers are hand-picked to line up with French (see french.ts): YDS 5.10a = 60 = French
// 6a, 5.11a = 72 = French 7a, 5.14a = 96 = French 8b+, 5.14d = 102 = French 9a.
const gradeMapping: Scale["gradeMapping"] = new Map([
  ["3rd class", 47],
  ["4th class", 48],
  ["5.3", 49],
  ["5.4", 50],
  ["5.5", 51],
  ["5.6", 52],
  ["5.7", 53],
  ["5.8-", 54],
  ["5.8", 55],
  ["5.8+", 56],
  ["5.9-", 57],
  ["5.9", 58],
  ["5.9+", 59],
  ["5.10a", 60],
  ["5.10a/b", 62],
  ["5.10b", 63],
  ["5.10b/c", 65],
  ["5.10c", 66],
  ["5.10c/d", 68],
  ["5.10d", 69],
  ["5.10d/11a", 71],
  ["5.11a", 72],
  ["5.11a/b", 73],
  ["5.11b", 74],
  ["5.11b/c", 75],
  ["5.11c", 76],
  ["5.11c/d", 77],
  ["5.11d", 78],
  ["5.11d/12a", 79],
  ["5.12a", 80],
  ["5.12a/b", 81],
  ["5.12b", 82],
  ["5.12b/c", 83],
  ["5.12c", 84],
  ["5.12c/d", 85],
  ["5.12d", 86],
  ["5.12d/13a", 87],
  ["5.13a", 88],
  ["5.13a/b", 89],
  ["5.13b", 90],
  ["5.13b/c", 91],
  ["5.13c", 92],
  ["5.13c/d", 93],
  ["5.13d", 94],
  ["5.13d/14a", 95],
  ["5.14a", 96],
  ["5.14a/b", 97],
  ["5.14b", 98],
  ["5.14b/c", 99],
  ["5.14c", 100],
  ["5.14c/d", 101],
  ["5.14d", 102],
  ["5.14d/15a", 103],
  ["5.15a", 104],
  ["5.15a/b", 105],
  ["5.15b", 106],
  ["5.15b/c", 107],
  ["5.15c", 108],
  ["5.15c/d", 109],
  ["5.15d", 110],
]);

const alternateNames = new Map<string, string>([
  // Pre-decimal-system historical class ratings, still occasionally seen in older guidebooks.
  ["III", "3rd class"],
  ["IV", "4th class"],
  ["V", "5.4"],
]);
for (let n = 10; n <= 15; n++) {
  alternateNames.set(`5.${n}-`, `5.${n}a/b`);
  alternateNames.set(`5.${n}`, `5.${n}b/c`);
  alternateNames.set(`5.${n}+`, `5.${n}c/d`);
}

const normalizer = normalizeFromGradeMappings(gradeMapping, alternateNames);

export const yds: Scale<"YDS"> = {
  id: "YDS",
  name: "Yosemite Decimal System",
  description: "North American route standard, developed for the Sierra Nevada range.",
  gradeType: "route",
  gradeMapping,
  numberToGradeTable: buildReverseTable(gradeMapping),
  alternateNames,
  // Mixes a lowercase letter-suffix convention ("5.10a") with uppercase historical Roman
  // numerals ("III"), so try the grade as given, then lowercased, then uppercased.
  normalize: (grade) => {
    const trimmed = grade.trim();
    return normalizer(trimmed) ?? normalizer(trimmed.toLowerCase()) ?? normalizer(trimmed.toUpperCase());
  },
  usedIn: "North America",
  flags: "🇺🇸🇨🇦",
  osmTagName: "yds_class",
  usageCount: 27,
};
