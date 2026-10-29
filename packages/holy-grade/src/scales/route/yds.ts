import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../builder";

// Numbers are hand-picked to line up with French (see french.ts): YDS 5.10a = 60 = French
// 6a, 5.11a = 72 = French 7a, 5.14a = 96 = French 8b+, 5.14d = 102 = French 9a.

const gradeMapping: Scale["gradeMapping"] = new Map([
  ["3rd class", 1],
  ["4th class", 13],
  ["5.3", 15],
  ["5.4", 21],
  ["5.5", 25],
  ["5.6", 29],
  ["5.7", 37],
  ["5.8-", 41],
  ["5.8", 45],
  ["5.8+", 49],
  ["5.9-", 51],
  ["5.9", 53],
  ["5.9+", 57],
  ["5.10a", 61],
  ["5.10-", 62],
  ["5.10a/b", 62],
  ["5.10b", 63],
  ["5.10", 64],
  ["5.10b/c", 64],
  ["5.10c", 65],
  ["5.10+", 66],
  ["5.10c/d", 66],
  ["5.10d", 67],
  ["5.10d/11a", 68],
  ["5.11a", 69],
  ["5.11-", 69],
  ["5.11b", 70],
  ["5.11", 70],
  ["5.11c", 71],
  ["5.11+", 72],
  ["5.11c/d", 72],
  ["5.11d", 73],
  ["5.11d/12a", 74],
  ["5.12a", 75],
  ["5.12-", 76],
  ["5.12a/b", 76],
  ["5.12b", 77],
  ["5.12", 78],
  ["5.12b/c", 78],
  ["5.12c", 79],
  ["5.12+", 80],
  ["5.12c/d", 80],
  ["5.12d", 81],
  ["5.12d/13a", 82],
  ["5.13a", 83],
  ["5.13-", 84],
  ["5.13a/b", 84],
  ["5.13b", 85],
  ["5.13", 86],
  ["5.13b/c", 86],
  ["5.13c", 87],
  ["5.13+", 88],
  ["5.13c/d", 88],
  ["5.13d", 89],
  ["5.13d/14a", 90],
  ["5.14a", 91],
  ["5.14-", 92],
  ["5.14a/b", 92],
  ["5.14b", 93],
  ["5.14", 94],
  ["5.14b/c", 94],
  ["5.14c", 95],
  ["5.14+", 96],
  ["5.14c/d", 96],
  ["5.14d", 97],
  ["5.14d/15a", 98],
  ["5.15a", 99],
  ["5.15-", 100],
  ["5.15a/b", 100],
  ["5.15b", 101],
  ["5.15", 102],
  ["5.15b/c", 102],
  ["5.15c", 103],
  ["5.15+", 104],
  ["5.15c/d", 104],
  ["5.15d", 105],
  ["5.15d/5.16a", 106],
  ["5.16a", 107],
  ["5.16a/b", 108],
  ["5.16b", 109],
]);

const alternateNames = new Map<string, string>([
  // Pre-decimal-system historical class ratings, still occasionally seen in older guidebooks.
  ["III", "3rd class"],
  ["IV", "4th class"],
  ["V", "5.3"],
  ["5.10d/5.11a", "5.10d/11a"],
  ["5.11d/5.12a", "5.11d/12a"],
  ["5.12d/5.13a", "5.12d/13a"],
  ["5.13d/5.14a", "5.13d/14a"],
  ["5.14d/5.15a", "5.14d/15a"],
  ["5.11a/b", "5.11a"],
  ["5.11b/c", "5.11b"],
]);
for (let n = 10; n <= 15; n++) {
  alternateNames.set(`5.${n}-`, `5.${n}a/b`);
  alternateNames.set(`5.${n}`, `5.${n}b/c`);
  alternateNames.set(`5.${n}+`, `5.${n}c/d`);
}
alternateNames.set("5.11-", "5.11a");
alternateNames.set("5.11", "5.11b");
alternateNames.set("5.11+", "5.11c/d");

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
