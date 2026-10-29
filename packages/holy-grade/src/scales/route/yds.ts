import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../builder";

// Numbers are hand-picked to line up with French (see french.ts): YDS 5.10a = 60 = French
// 6a, 5.11a = 72 = French 7a, 5.14a = 96 = French 8b+, 5.14d = 102 = French 9a.

const gradeMapping: Scale["gradeMapping"] = new Map([
  ["3rd class", 1],
  ["4th class", 13],
  ["5.3", 15],
  ["5.3/5.4", 18],
  ["5.4", 21],
  ["5.4/5.5", 23],
  ["5.5", 25],
  ["5.5/5.6", 27],
  ["5.6", 29],
  ["5.6/5.7", 33],
  ["5.7", 37],
  ["5.7/5.8", 39],
  ["5.8-", 41],
  ["5.8", 45],
  ["5.8/5.9", 47],
  ["5.8+", 49],
  ["5.9-", 51],
  ["5.9", 53],
  ["5.9+", 57],
  ["5.9/5.10a", 59],
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
  ["5.11-", 70],
  ["5.11a/b", 70],
  ["5.11b", 71],
  ["5.11", 72],
  ["5.11b/c", 72],
  ["5.11c", 73],
  ["5.11+", 74],
  ["5.11c/d", 74],
  ["5.11d", 75],
  ["5.11d/12a", 76],
  ["5.12a", 77],
  ["5.12-", 78],
  ["5.12a/b", 78],
  ["5.12b", 79],
  ["5.12", 80],
  ["5.12b/c", 80],
  ["5.12c", 81],
  ["5.12+", 82],
  ["5.12c/d", 82],
  ["5.12d", 83],
  ["5.12d/13a", 84],
  ["5.13a", 85],
  ["5.13-", 86],
  ["5.13a/b", 86],
  ["5.13b", 87],
  ["5.13", 88],
  ["5.13b/c", 88],
  ["5.13c", 89],
  ["5.13+", 90],
  ["5.13c/d", 90],
  ["5.13d", 91],
  ["5.13d/14a", 92],
  ["5.14a", 93],
  ["5.14-", 94],
  ["5.14a/b", 94],
  ["5.14b", 95],
  ["5.14", 96],
  ["5.14b/c", 96],
  ["5.14c", 97],
  ["5.14+", 98],
  ["5.14c/d", 98],
  ["5.14d", 99],
  ["5.14d/15a", 100],
  ["5.15a", 101],
  ["5.15-", 102],
  ["5.15a/b", 102],
  ["5.15b", 103],
  ["5.15", 104],
  ["5.15b/c", 104],
  ["5.15c", 105],
  ["5.15+", 106],
  ["5.15c/d", 106],
  ["5.15d", 107],
  ["5.15d/5.16a", 108],
  ["5.16a", 109],
  ["5.16a/b", 110],
  ["5.16b", 111],
]);

const alternateNames = new Map<string, string>([
  // Pre-decimal-system historical class ratings, still occasionally seen in older guidebooks.
  ["III", "3rd class"],
  ["IV", "4th class"],
  ["V", "5.3"],
  ["5.3/4", "5.3/5.4"],
  ["5.4/5", "5.4/5.5"],
  ["5.5/6", "5.5/5.6"],
  ["5.6/7", "5.6/5.7"],
  ["5.7/8", "5.7/5.8"],
  ["5.8/9", "5.8/5.9"],
  ["5.9/10a", "5.9/5.10a"],
  ["5.9/5.10", "5.9/5.10a"],
  ["5.9+/5.10a", "5.9/5.10a"],
  ["5.10d/5.11a", "5.10d/11a"],
  ["5.11d/5.12a", "5.11d/12a"],
  ["5.12d/5.13a", "5.12d/13a"],
  ["5.13d/5.14a", "5.13d/14a"],
  ["5.14d/5.15a", "5.14d/15a"],
]);
for (let n = 10; n <= 16; n++) {
  alternateNames.set(`5.${n}-`, `5.${n}a/b`);
  alternateNames.set(`5.${n}`, `5.${n}b/c`);
  alternateNames.set(`5.${n}+`, `5.${n}c/d`);
  alternateNames.set(`5.${n}a/5.${n}b`, `5.${n}a/b`);
  alternateNames.set(`5.${n}b/5.${n}c`, `5.${n}b/c`);
  alternateNames.set(`5.${n}c/5.${n}d`, `5.${n}c/d`);
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
