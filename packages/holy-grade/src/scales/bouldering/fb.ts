import type { GradeMapping, NormalizationGradeMapping, Scale } from "../types";
import { french } from "../route/french";
import { normalizeFromGradeMappings } from "../helpers";

const gradeMapping: GradeMapping = new Map(
  french.gradeMapping.entries().map(([name, value]) => [name.toUpperCase(), value]),
);

const extendedGradeNormalizationMapping: NormalizationGradeMapping = new Map(
  french
    .extendedGradeNormalizationMapping!.entries()
    .map(([name, value]) => [name, value.toUpperCase()]),
);

const normalizer = normalizeFromGradeMappings(gradeMapping, extendedGradeNormalizationMapping);

export const fb: Scale<"FB"> = {
  id: "FB",
  name: "Fontainebleau",
  description:
    "The Fontainebleau scale is a bouldering grading system that originated in the Fontainebleau forest in France. It is widely used in Europe and has become a standard for bouldering grades worldwide.",

  gradeType: "boulder",
  gradeMapping,
  extendedGradeNormalizationMapping,

  normalize: (grade) => {
    return normalizer(grade.toUpperCase());
  },
};
