import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../builder";

let n = 1;
const gradeMapping: Scale["gradeMapping"] = new Map([
  ["A0-", n++],
  ["A0", n++],
  ["A1", n++],
  ["A1+", n++],
  ["A2", n++],
  ["A2+", n++],
  ["A3", n++],
  ["A3+", n++],
  ["A4", n++],
  ["A4+", n++],
  ["A5", n++],
  ["A5+", n++],
  ["A6", n++],
]);

// "Clean aid" routes (no hammer/pitons) are conventionally graded with a C instead of an A
// for the same difficulty, up to about C3 — beyond that, clean aid isn't really a distinct
// category in practice, so there's no C4/C5/C6.
const alternateNames = new Map<string, string>([
  ["C0", "A0"],
  ["C1", "A1"],
  ["C2", "A2"],
  ["C2+", "A2+"],
  ["C3", "A3"],
  ["C3+", "A3+"],
]);

const normalizer = normalizeFromGradeMappings(gradeMapping, alternateNames);

export const aid: Scale<"Aid"> = {
  id: "Aid",
  name: "Aid",
  description:
    "The American aid-climbing scale (A0-A6), for routes climbed with the aid of gear rather than free-climbed.",
  gradeType: "aid",
  gradeMapping,
  numberToGradeTable: buildReverseTable(gradeMapping),
  alternateNames,
  normalize: (grade) => normalizer(grade.trim().toUpperCase()),
  usedIn: "Primarily North America",
  flags: "🇺🇸",
  // Guessed OSM tag naming convention — see the same note in dryTooling.ts.
  osmTagName: "aid",
  usageCount: 0,
};
