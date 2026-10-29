import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings, numeralAlternateNames } from "../builder";

// Numbers are hand-picked to line up with French (see french.ts): Saxon VIIb = 61 =
// French 6a, Saxon IXa = 73 = French 7a, Saxon Xb = 81 = French 7c, Saxon XIa = 85 = French 8a,
// Saxon XIc = 91 = French 8b+, Saxon XIIc = 97 = French 9a.
const gradeMapping: Scale["gradeMapping"] = new Map([
  ["I", 33],
  ["I/II", 36],
  ["II", 39],
  ["II/III", 42],
  ["III", 45],
  ["III/IV", 48],
  ["IV", 51],
  ["IV/V", 53],
  ["V", 55],
  ["V/VI", 56],
  ["VI", 57],
  ["VI/VIIa", 58],
  ["VIIa", 59],
  ["VIIa/VIIb", 60],
  ["VIIb", 61],
  ["VIIb/VIIc", 62],
  ["VIIc", 63],
  ["VIIc/VIIIa", 64],
  ["VIIIa", 65],
  ["VIIIa/VIIIb", 66],
  ["VIIIb", 67],
  ["VIIIb/VIIIc", 68],
  ["VIIIc", 70],
  ["VIIIc/IXa", 72],
  ["IXa", 75],
  ["IXa/IXb", 76],
  ["IXb", 77],
  ["IXb/IXc", 78],
  ["IXc", 79],
  ["IXc/Xa", 80],
  ["Xa", 81],
  ["Xa/Xb", 82],
  ["Xb", 83],
  ["Xb/Xc", 84],
  ["Xc", 85],
  ["Xc/XIa", 86],
  ["XIa", 87],
  ["XIa/XIb", 89],
  ["XIb", 91],
  ["XIb/XIc", 92],
  ["XIc", 93],
  ["XIc/XIIa", 94],
  ["XIIa", 95],
  ["XIIa/XIIb", 96],
  ["XIIb", 97],
  ["XIIb/XIIc", 98],
  ["XIIc", 99],
  ["XIIc/XIIIa", 100],
  ["XIIIa", 101],
  ["XIIIa/XIIIb", 103],
  ["XIIIb", 105],
  ["XIIIb/XIIIc", 106],
  ["XIIIc", 107],
  ["XIIIc/>XIIIc", 108],
  [">XIIIc", 109],
]);

// Saxon's canonical form is Roman numerals with subgrades (a/b/c from VII up).
// Map plain whole Roman numbers without letters (e.g. "VII" -> "VIIb") as alternates,
// and Arabic numerals as alternates.
const alternateNames = new Map<string, string>([
  ["VII", "VIIb"],
  ["VIII", "VIIIb"],
  ["IX", "IXb"],
  ["X", "Xb"],
  ["XI", "XIb"],
  ["XII", "XIIb"],
  ["XIII", "XIIIb"],
  ["1", "I"],
  ["2", "II"],
  ["3", "III"],
  ["4", "IV"],
  ["5", "V"],
  ["6", "VI"],
  ["7", "VIIb"],
  ["7a", "VIIa"],
  ["7b", "VIIb"],
  ["7c", "VIIc"],
  ["8", "VIIIb"],
  ["8a", "VIIIa"],
  ["8b", "VIIIb"],
  ["8c", "VIIIc"],
  ["9", "IXb"],
  ["9a", "IXa"],
  ["9b", "IXb"],
  ["9c", "IXc"],
  ["10", "Xb"],
  ["10a", "Xa"],
  ["10b", "Xb"],
  ["10c", "Xc"],
  ["11", "XIb"],
  ["11a", "XIa"],
  ["11b", "XIb"],
  ["11c", "XIc"],
  ["12", "XIIb"],
  ["12a", "XIIa"],
  ["12b", "XIIb"],
  ["12c", "XIIc"],
  ["13", "XIIIb"],
  ["13a", "XIIIa"],
  ["13b", "XIIIb"],
  ["13c", "XIIIc"],
]);

function formatSaxon(g: string): string {
  return g
    .split("/")
    .map((part) => {
      const m = part.match(/^([ivxlcdm]+?)([abc]?)$/i);
      if (!m) return part;
      return `${m[1].toUpperCase()}${m[2].toLowerCase()}`;
    })
    .join("/");
}

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
  normalize: (grade) => {
    const trimmed = grade.trim();
    return (
      normalizer(trimmed) ??
      normalizer(formatSaxon(trimmed)) ??
      normalizer(trimmed.toUpperCase()) ??
      normalizer(trimmed.toLowerCase())
    );
  },
  nameAlt: "Swiss",
  usedIn: "Switzerland",
  flags: "🇩🇪🇨🇿",
  osmTagName: "saxon",
  usageCount: 0,
};
