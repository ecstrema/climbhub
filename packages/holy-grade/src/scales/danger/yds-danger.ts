import type { AlternateNamesMapping, Scale } from "../types";
import { buildReverseTable, normalizeFromGradeMappings } from "../builder";

// The Yosemite Decimal System danger / protection ratings:
// G: Good protection, normal trad lead fall risk.
// PG / PG-13: Adequate to sparse gear, potential for injury on long falls.
// R: Runout, fall carries high risk of serious injury / broken bones.
// R/X: Extremely bold and runout, fall likely to cause death or catastrophic injury.
// X: Little to no protection, fall is fatal or near-certain ground fall.
//
// Calibrated to align with UK Adjectival danger equivalents:
// G = 3 (D), G/PG = 5 (VD), PG = 11 (HS/VS), PG/PG-13 = 14 (HVS),
// PG-13 = 16 (E1), PG-13/R = 19 (E2/E3), R = 21 (E3/E4), R/X = 26 (E6), X = 32 (E9).
const gradeMapping: Scale["gradeMapping"] = new Map([
  ["G", 3],
  ["G/PG", 5],
  ["PG", 11],
  ["PG/PG-13", 14],
  ["PG-13", 16],
  ["PG-13/R", 19],
  ["R", 21],
  ["R/X", 26],
  ["X", 32],
]);

const alternateNames: AlternateNamesMapping = new Map([
  ["PG13", "PG-13"],
  ["PG/PG13", "PG/PG-13"],
  ["PG13/R", "PG-13/R"],
  ["RX", "R/X"],
  ["R-X", "R/X"],
  ["R/RX", "R/X"],
  ["R/R-X", "R/X"],
  ["G/PG13", "PG"],
]);

const normalizer = normalizeFromGradeMappings(gradeMapping, alternateNames);

export const ydsDanger: Scale<"YDSDanger"> = {
  id: "YDSDanger",
  name: "YDS Danger",
  description:
    "The Yosemite protection/risk rating scale (G, PG, PG-13, R, R/X, X), indicating the seriousness and risk of leader falls.",
  gradeType: "danger",
  gradeMapping,
  numberToGradeTable: buildReverseTable(gradeMapping),
  alternateNames,
  normalize: (grade) => normalizer(grade.trim().toUpperCase()),
  nameAlt: "YDS Risk",
  usedIn: "North America",
  flags: "🇺🇸🇨🇦",
  osmTagName: "yds_danger",
  usageCount: 0,
};
