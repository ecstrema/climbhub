import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings, numeralAlternateNames } from "../builder";

// Numbers are hand-picked to line up with French (see french.ts): Saxon VIIb = 61 =
// French 6a, Saxon IXa = 73 = French 7a, Saxon Xb = 81 = French 7c, Saxon XIa = 85 = French 8a,
// Saxon XIc = 91 = French 8b+, Saxon XIIc = 97 = French 9a.
const gradeMapping: Scale["gradeMapping"] = new Map([
  ["I", 33],
  ["II", 39],
  ["III", 45],
  ["IV", 51],
  ["V", 55],
  ["VI", 57],
  ["VIIa", 59],
  ["VIIb", 61],
  ["VIIc", 63],
  ["VIIc/VIIIa", 64],
  ["VIIIa", 65],
  ["VIIIa/VIIIb", 66],
  ["VIIIb", 67],
  ["VIIIb/VIIIc", 68],
  ["VIIIc", 69],
  ["VIIIc/IXa", 71],
  ["IXa", 73],
  ["IXa/IXb", 74],
  ["IXb", 75],
  ["IXb/IXc", 76],
  ["IXc", 77],
  ["IXc/Xa", 78],
  ["Xa", 79],
  ["Xa/Xb", 80],
  ["Xb", 81],
  ["Xb/Xc", 82],
  ["Xc", 83],
  ["Xc/XIa", 84],
  ["XIa", 85],
  ["XIa/XIb", 87],
  ["XIb", 89],
  ["XIb/XIc", 90],
  ["XIc", 91],
  ["XIc/XIIa", 92],
  ["XIIa", 93],
  ["XIIa/XIIb", 94],
  ["XIIb", 95],
  ["XIIb/XIIc", 96],
  ["XIIc", 97],
  ["XIIIa", 99],
  ["XIIIa/XIIIb", 101],
  ["XIIIb", 103],
  ["XIIIb/XIIIc", 104],
  ["XIIIc", 105],
  [">XIIIc", 107],
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
