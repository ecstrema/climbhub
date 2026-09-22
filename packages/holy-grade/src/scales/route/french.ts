import type { GradeMapping, NormalizationGradeMapping, Scale } from "../types";
import { normalizeFromGradeMappings } from "../helpers";

const gradeMapping: GradeMapping = new Map();
const variantsPerNumber: string[] = [
  "a",
  "a/+",
  "a+",
  "a+/b",
  "b",
  "b/+",
  "b+",
  "b+/c",
  "c",
  "c/+",
  "c+",
];
for (let n = 1; n <= 9; n++) {
  for (let qualifierIndex = 0; qualifierIndex < variantsPerNumber.length; qualifierIndex++) {
    const qualifier = variantsPerNumber[qualifierIndex];
    const grade = `${n}${qualifier}`;
    gradeMapping.set(grade, (n - 1) * (variantsPerNumber.length + 1) + qualifierIndex + 1);
  }
  const transitionGrade = `${n}c+/${n + 1}a`;
  gradeMapping.set(
    transitionGrade,
    (n - 1) * (variantsPerNumber.length + 1) + variantsPerNumber.length + 1,
  );
}
gradeMapping.set("10a", 9 * (variantsPerNumber.length + 1) + 1);

const extendedGradeNormalizationMapping: NormalizationGradeMapping = new Map([
  ["1-", "1a"],
  ["1", "1b"],
  ["1+", "1c"],
  ["2-", "2a"],
  ["2", "2b"],
  ["2+", "2c"],
  ["3-", "3a"],
  ["3", "3b"],
  ["3+", "3c"],
  ["4-", "4a"],
  ["4", "4b"],
  ["4+", "4c"],
  ["5-", "5a"],
  ["5", "5b"],
  ["5+", "5c"],
]);

const normalizer = normalizeFromGradeMappings(gradeMapping, extendedGradeNormalizationMapping);
export const french: Scale<"French"> = {
  id: "French",
  name: "French Scale",
  description: "Now the most common scale in the world, born in France.",
  gradeType: "route",
  gradeMapping,
  extendedGradeNormalizationMapping,
  normalize: (grade) => normalizer(grade.toLowerCase()),
};
