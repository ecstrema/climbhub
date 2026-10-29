import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../builder";

// Numbers are hand-picked to line up with French (see french.ts): UKAdj E1 = 61 =
// French 6a, E2 = 65 = French 6b, E3 = 69 = French 6c, E4 = 73 = French 7a,
// E6 = 81 = French 7c, E7 = 85 = French 8a, E10 = 97 = French 9a.
const gradeMapping: Scale["gradeMapping"] = new Map([
  ["M", 11],
  ["M/D", 17],
  ["D", 23],
  ["D/VD", 29],
  ["VD", 37],
  ["VD/HVD", 39],
  ["HVD", 40],
  ["S", 41],
  ["S/HS", 43],
  ["HS", 45],
  ["HS/VS", 47],
  ["VS", 49],
  ["VS/HVS", 51],
  ["HVS", 53],
  ["HVS/E1", 57],
  ["E1", 61],
  ["E1/E2", 63],
  ["E2", 65],
  ["E2/E3", 67],
  ["E3", 69],
  ["E3/E4", 71],
  ["E4", 73],
  ["E4/E5", 74],
  ["E5", 76],
  ["E5/E6", 78],
  ["E6", 81],
  ["E6/E7", 83],
  ["E7", 85],
  ["E7/E8", 87],
  ["E8", 89],
  ["E8/E9", 91],
  ["E9", 93],
  ["E9/E10", 95],
  ["E10", 97],
  ["E10/E11", 98],
  ["E11", 99],
  [">E11", 103],
]);

const normalizer = normalizeFromGradeMappings(gradeMapping);

export const ukAdj: Scale<"UKAdj"> = {
  id: "UKAdj",
  name: "UK Adjectival",
  description: "The overall-assessment scale used alongside UK Technical for traditional climbs in Britain.",
  gradeType: "route",
  gradeMapping,
  numberToGradeTable: buildReverseTable(gradeMapping),
  normalize: (grade) => normalizer(grade.trim().toUpperCase()),
  usedIn: "UK",
  flags: "🇬🇧",
  osmTagName: "british_adjectival",
  usageCount: 0,
};
