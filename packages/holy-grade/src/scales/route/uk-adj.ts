import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../helpers";

const gradeMapping: Scale["gradeMapping"] = new Map([
  ["M", 0],
  ["M/D", 4],
  ["D", 7],
  ["D/VD", 11],
  ["VD", 15],
  ["S", 19],
  ["HS", 22],
  ["HS/VS", 26],
  ["VS", 30],
  ["HVS", 33],
  ["E1", 37],
  ["E1/E2", 41],
  ["E2", 44],
  ["E2/E3", 48],
  ["E3", 52],
  ["E4", 56],
  ["E4/E5", 59],
  ["E5", 63],
  ["E6", 67],
  ["E6/E7", 70],
  ["E7", 74],
  ["E7/E8", 78],
  ["E8", 81],
  ["E9", 85],
  ["E9/E10", 89],
  ["E10", 93],
  ["E11", 96],
  [">E11", 100],
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
