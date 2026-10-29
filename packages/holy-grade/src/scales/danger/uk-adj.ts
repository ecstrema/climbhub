import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../builder";

// The British adjectival rating scale (from Moderate up to E11), assessing the overall
// boldness, danger, and seriousness of a traditional route.
// Compacted to consecutive indices 1..37.
let n = 1;
const gradeMapping: Scale["gradeMapping"] = new Map([
  ["M", n++],
  ["M/D", n++],
  ["D", n++],
  ["D/VD", n++],
  ["VD", n++],
  ["VD/HVD", n++],
  ["HVD", n++],
  ["S", n++],
  ["S/HS", n++],
  ["HS", n++],
  ["HS/VS", n++],
  ["VS", n++],
  ["VS/HVS", n++],
  ["HVS", n++],
  ["HVS/E1", n++],
  ["E1", n++],
  ["E1/E2", n++],
  ["E2", n++],
  ["E2/E3", n++],
  ["E3", n++],
  ["E3/E4", n++],
  ["E4", n++],
  ["E4/E5", n++],
  ["E5", n++],
  ["E5/E6", n++],
  ["E6", n++],
  ["E6/E7", n++],
  ["E7", n++],
  ["E7/E8", n++],
  ["E8", n++],
  ["E8/E9", n++],
  ["E9", n++],
  ["E9/E10", n++],
  ["E10", n++],
  ["E10/E11", n++],
  ["E11", n++],
  [">E11", n++],
]);

const normalizer = normalizeFromGradeMappings(gradeMapping);

export const ukAdj: Scale<"UKAdj"> = {
  id: "UKAdj",
  name: "UK Adjectival",
  description: "The overall-assessment scale used alongside UK Technical for traditional climbs in Britain.",
  gradeType: "danger",
  gradeMapping,
  numberToGradeTable: buildReverseTable(gradeMapping),
  normalize: (grade) => normalizer(grade.trim().toUpperCase()),
  usedIn: "UK",
  flags: "🇬🇧",
  osmTagName: "british_adjectival",
  usageCount: 0,
};
