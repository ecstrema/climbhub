import type { GradeMapping, Scale } from "../types";
import { normalizeFromGradeMappings } from "../helpers";

const gradeMapping: GradeMapping = {
  VB: 25.5,
  "V0-": 50,
  V0: 56,
  V1: 62.5,
  V2: 64.5,
  V3: 67.5,
  V4: 71.5,
  V5: 75,
  V6: 77.5,
  V7: 79.5,
  V8: 82.5,
  V9: 85.5,
  V10: 87,
  V11: 88.5,
  V12: 90.5,
  V13: 92.5,
  V14: 94.5,
  V15: 96.5,
  V16: 98.5,
  V17: 100,
  V18: 102,
};

const normalizer = normalizeFromGradeMappings(gradeMapping);

export const hueco: Scale = {
  id: "Hueco",
  name: "Hueco Scale - V Scale",
  description: "A bouldering grade system used primarily in North America.",

  gradeType: "boulder",

  gradeMapping,

  normalize: (grade) => {
    return normalizer(grade.toUpperCase());
  },
};
