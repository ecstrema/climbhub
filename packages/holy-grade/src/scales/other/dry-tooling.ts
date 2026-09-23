import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../helpers";

let n = 0;
const gradeMapping: Scale["gradeMapping"] = new Map([
  ["D0", n++],
  ["D1", n++],
  ["D2", n++],
  ["D3", n++],
  ["D4", n++],
  ["D5", n++],
  ["D6", n++],
  ["D7", n++],
  ["D8", n++],
  ["D9", n++],
  ["D10", n++],
  ["D11", n++],
  ["D12", n++],
  ["D13", n++],
  ["D14", n++],
  ["D15", n++],
]);

const normalizer = normalizeFromGradeMappings(gradeMapping);

export const dryTooling: Scale<"DryTooling"> = {
  id: "DryTooling",
  name: "Dry Tooling",
  description:
    "The D-scale used for dry-tooling routes (ice tools on rock, no ice). Closely related to — but graded separately from — the Mixed (M) scale.",
  gradeType: "ice",
  gradeMapping,
  numberToGradeTable: buildReverseTable(gradeMapping),
  normalize: (grade) => normalizer(grade.trim().toUpperCase()),
  usedIn: "Alpine ice/mixed climbing regions (Alps, Rockies, etc.)",
  flags: "🇨🇦🇫🇷",
  // Guessed OSM tag naming convention — no established climbing:grade:* key exists for this
  // scale yet, unlike the others (which were ported from real OSM usage).
  osmTagName: "dry_tooling",
  usageCount: 0,
};
