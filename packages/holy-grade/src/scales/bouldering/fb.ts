import type { Scale } from "../types";
import { french } from "../route/french";
import { normalizeFromGradeMappings } from "../helpers";

const gradeMapping = Object.fromEntries(
  Object.entries(french.gradeMapping).map(([name, value]) => [name.toUpperCase(), value]),
);

const extendedGradeNormalizationMapping = Object.fromEntries(
  Object.entries(french.extendedGradeNormalizationMapping!).map(([name, value]) => [
    name,
    value.toUpperCase(),
  ]),
);

const normalizer = normalizeFromGradeMappings(gradeMapping, extendedGradeNormalizationMapping);

export const fb: Scale = {
  id: "FB",
  name: "Fontainebleau",
  description:
    "The Fontainebleau scale is a bouldering grading system that originated in the Fontainebleau forest in France. It is widely used in Europe and has become a standard for bouldering grades worldwide. The FB acronym can stand for Fontainebleau, French-British, or French-Bouldering.",

  gradeType: "boulder",
  gradeMapping,
  extendedGradeNormalizationMapping,

  normalize: (grade) => {
    return normalizer(grade.toUpperCase());
  },
};
