import type { AlternateNamesMapping, GradeMapping, Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../builder";

// Numbers are hand-picked to line up with equivalent grades in other scales (see yds.ts,
// uiaa.ts, saxon.ts): French 6a = 60 = YDS 5.10a, 7a = 72 = 5.11a, 8b+ = 96 = 5.14a,
// 9a = 102 = 5.14d. If you edit these in the app (dev mode only — see
// GradeComparisonChart.svelte's drag-to-edit and download feature), paste the downloaded
// text back in here.

const gradeMapping: GradeMapping = new Map([]);
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

const alternates: AlternateNamesMapping = new Map([
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
])

const normalizer = normalizeFromGradeMappings(gradeMapping, alternates);

export const french: Scale<"French"> = {
  id: "French",
  name: "French",
  description:
    "The French numerical system rates a climb according to the overall technical difficulty and strenuousness of the route. The most common scale in the world outside North America.",
  gradeType: "route",
  gradeMapping,
  alternateNames: alternates,
  numberToGradeTable: buildReverseTable(gradeMapping),
  // Route grades are written lowercase ("7a"), unlike Fontainebleau boulder grades ("7A") —
  // see fb.ts.
  normalize: (grade) => normalizer(grade.trim().toLowerCase()),
  usedIn: "Everywhere except North America",
  flags: "🇪🇺🇫🇷",
  osmTagName: "french",
  usageCount: 0,
};
