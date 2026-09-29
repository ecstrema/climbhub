import type { Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../builder";

const gradeMapping: Scale["gradeMapping"] = new Map();
for (let n = 1; n < 14; n++) {
  gradeMapping.set(`D${n}`, 2 * n - 1)
  gradeMapping.set(`D${n}/${n+1}`, 2 * n)
}

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
