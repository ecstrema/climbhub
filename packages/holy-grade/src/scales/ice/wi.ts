import type { Scale } from "../types";
import { normalizeFromGradeMappings } from "../helpers";

const gradeMapping = {
  WI1: 10,
  "WI1+": 15,
  WI2: 20,
  "WI2+": 25,
  WI3: 30,
  "WI3+": 35,
  WI4: 40,
  "WI4+": 45,
  WI5: 50,
  "WI5+": 55,
  WI6: 60,
  "WI6+": 65,
};

const extendedGradeNormalizationMapping = {};

const normalizer = normalizeFromGradeMappings(gradeMapping, extendedGradeNormalizationMapping);

export const wi: Scale<"WI"> = {
  id: "WI",
  name: "World Ice", // Waterfall Ice? Todo: check
  description: "Standard Ice Climbing grade",

  gradeType: "ice",
  gradeMapping,
  extendedGradeNormalizationMapping,

  normalize: (grade) => {
    return normalizer(grade.toUpperCase());
  },
};
