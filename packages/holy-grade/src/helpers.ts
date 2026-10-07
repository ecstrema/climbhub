import { getScale } from "./scales";
import type { GradeType, Scale, ScaleId } from "./scales/types";

/** Whether `grade` (after normalization) is a valid grade for the given scale. */
export function isValidGrade(scale: Scale | ScaleId, grade: string): boolean {
  return typeof scale === "string"
    ? getScale(scale)?.normalize(grade) !== undefined
    : scale.normalize(grade) !== undefined;
}

/**
 * Finds the grade in `scale` whose rank is closest to `reference`, via the reverse table —
 * used to translate a cursor/pointer position on the comparison chart's shared axis (which
 * usually won't land exactly on a rank that has a grade) back into a grade label.
 */
export function getGradeFromReference<T extends ScaleId>(
  reference: number,
  scale: Scale<T> | T,
): string | undefined {
  if (typeof scale === "string") {
    const maybeScale = getScale(scale);
    if (!maybeScale) return undefined;
    scale = maybeScale as Scale<T>;
  }
  const table = scale.numberToGradeTable;
  const rounded = Math.round(reference);

  // Array indexing is `string | undefined` here (not just "in practice, but TS doesn't know
  // it") because the table is sparse — most ranks have no grade at all.
  const exact = table[rounded];
  if (exact !== undefined) return exact;

  for (let offset = 1; offset < table.length; offset++) {
    const below = table[rounded - offset];
    if (below !== undefined) return below;
    const above = table[rounded + offset];
    if (above !== undefined) return above;
  }
  return undefined;
}

/**
 * Converts a grade from one scale to its closest equivalent in another, via each scale's
 * gradeMapping rank. Only meaningful between scales whose ranks were actually hand-calibrated
 * to line up (see the comments at the top of each scale file) — for two arbitrary scales this
 * will still return *something*, but it won't mean anything.
 */
export function convertGrade(
  grade: string,
  from: Scale | ScaleId,
  to: Scale | ScaleId,
): string | undefined {
  const fromScale = typeof from === "string" ? getScale(from) : from;
  const toScale = typeof to === "string" ? getScale(to) : to;
  if (!fromScale || !toScale) return undefined;

  const normalized = fromScale.normalize(grade);
  if (normalized === undefined) return undefined;
  const rank = fromScale.gradeMapping.get(normalized);
  if (rank === undefined) return undefined;
  return getGradeFromReference(rank, toScale);
}

/**
 * Looks up the reference/rank number for a grade in a scale (normalizing first). Same idea
 * as gradeToNumber, but takes the resolved Scale object instead of a ScaleId — handy when
 * you already have the scale (e.g. from getScale), like getColorFromGrade does.
 */
export function getReference(grade: string, scale: Scale | ScaleId): number | undefined {
  const s = typeof scale === "string" ? getScale(scale) : scale;
  if (!s) return undefined;
  const normalized = s.normalize(grade);
  if (normalized === undefined) return undefined;
  return s.gradeMapping.get(normalized);
}

/** Minimum is always at 0 */
export interface DifficultyRange {
  beginner: number;
  intermediate: number;
  advanced: number;
  pro: number;
  max: number;
}

/**
 * Beginner and expert reference-number bounds per climbing type, in that type's own
 * reference-number space (see each scale file's gradeMapping — buildReverseTable etc. use
 * the same numbers). A grade's difficulty color is picked by interpolating where its
 * reference number falls between `beginner` and `max` for its gradeType — see
 * getColorFromGrade in the consuming app. There's no separate "intermediate"/"advanced"
 * number: those are just the middle stops of that same interpolation, evenly spaced.
 *
 * These bounds are picked to cover every scale of that type — e.g. "route" spans UIAA's low
 * end (30) through French/YDS's high end (114), with a little rounding for headroom. Update
 * by hand if a scale's own gradeMapping range changes (e.g. after editing via the
 * Grade Comparison chart's drag-to-edit feature).
 */
export const DIFFICULTY_RANGE: Record<GradeType, DifficultyRange> = {
  route: { beginner: 40, intermediate: 60, advanced: 80, pro: 100, max: 120 },
  boulder: { beginner: 37, intermediate: 61, advanced: 73, pro: 85, max: 101 },
  ice: { beginner: 1, intermediate: 5, advanced: 11, pro: 17, max: 26 },
  aid: { beginner: 0, intermediate: 2, advanced: 6, pro: 9, max: 13 },
};
