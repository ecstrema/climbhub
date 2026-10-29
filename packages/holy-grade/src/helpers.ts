import { allScales, getScale, ukAdj, ukTech, yds, ydsDanger } from "./scales";
import type { DangerScaleId, GradeType, ParsedGrade, Scale, ScaleId } from "./scales/types";

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
  danger: { beginner: 3, intermediate: 12, advanced: 21, pro: 30, max: 37 },
};

function checkDangerToken(token: string): { grade: string; scale: DangerScaleId } | undefined {
  const ukNorm = ukAdj.normalize(token);
  if (ukNorm) return { grade: ukNorm, scale: "UKAdj" };

  const ydsNorm = ydsDanger.normalize(token);
  if (ydsNorm) return { grade: ydsNorm, scale: "YDSDanger" };

  return undefined;
}

function checkPrimaryToken(
  token: string,
  preferredScales?: Scale[],
): { grade: string; scale: ScaleId } | undefined {
  let fallbackMatch: { grade: string; scale: ScaleId } | undefined;

  const candidateScales = preferredScales
    ? [...preferredScales, ...allScales.filter((s) => !preferredScales.includes(s))]
    : allScales;

  for (const scale of candidateScales) {
    if (scale.gradeType !== "danger") {
      const norm = scale.normalize(token);
      if (norm) {
        // If the normalized grade preserves the exact casing of the token, return immediately
        if (norm === token) {
          return { grade: norm, scale: scale.id };
        }
        if (!fallbackMatch) {
          fallbackMatch = { grade: norm, scale: scale.id };
        }
      }
    }
  }

  return fallbackMatch;
}

function tokenize(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const cleaned = trimmed.replace(/[(),]/g, " ").replace(/\s+/g, " ").trim();
  const parts = cleaned.split(" ").filter(Boolean);

  if (parts.length === 1) {
    const single = parts[0]!;
    if (checkDangerToken(single) || checkPrimaryToken(single)) {
      return parts;
    }

    if (single.includes("/")) {
      const slashIdx = single.lastIndexOf("/");
      const p1 = single.slice(0, slashIdx);
      const p2 = single.slice(slashIdx + 1);
      if (
        (checkDangerToken(p1) && checkPrimaryToken(p2)) ||
        (checkPrimaryToken(p1) && checkDangerToken(p2))
      ) {
        return [p1, p2];
      }
    }

    const dangerSuffixMatch = single.match(
      /^(.*?)(?:\s*[-/]?\s*)(PG-?13|R\/X|R-X|RX|G\/PG|PG|R|X)$/i,
    );
    if (dangerSuffixMatch && dangerSuffixMatch[1]) {
      const p1 = dangerSuffixMatch[1];
      const p2 = dangerSuffixMatch[2];
      if (checkPrimaryToken(p1) && checkDangerToken(p2)) {
        return [p1, p2];
      }
    }

    const ukGluedMatch = single.match(/^(E\d+|HVS|VS|HS|HVD|VD|S|D|M)\s*[-/]?\s*([1-7][a-c]?)$/i);
    if (ukGluedMatch) {
      return [ukGluedMatch[1], ukGluedMatch[2]];
    }
  }

  return parts;
}

/**
 * Parses a climbing grade string that may include both a primary technical/difficulty grade
 * (e.g. "5.10a", "5b", "6a", "V5") and/or a danger rating (e.g. "PG-13", "R", "X", "E1", "HVS").
 *
 * Examples:
 * - "E1 5b" -> { primary: { grade: "5b", scale: "UKTech" }, danger: { grade: "E1", scale: "UKAdj" }, raw: "E1 5b" }
 * - "5.10a R" -> { primary: { grade: "5.10a", scale: "YDS" }, danger: { grade: "R", scale: "YDSDanger" }, raw: "5.10a R" }
 * - "5.11b (PG-13)" -> { primary: { grade: "5.11b", scale: "YDS" }, danger: { grade: "PG-13", scale: "YDSDanger" }, raw: "5.11b (PG-13)" }
 * - "V7 X" -> { primary: { grade: "V7", scale: "Hueco" }, danger: { grade: "X", scale: "YDSDanger" }, raw: "V7 X" }
 * - "WI5 R" -> { primary: { grade: "WI5", scale: "WI" }, danger: { grade: "R", scale: "YDSDanger" }, raw: "WI5 R" }
 * - "6a" -> { primary: { grade: "6a", scale: "French" }, raw: "6a" }
 * - "E2" -> { danger: { grade: "E2", scale: "UKAdj" }, raw: "E2" }
 * - "PG-13" -> { danger: { grade: "PG-13", scale: "YDSDanger" }, raw: "PG-13" }
 */
export function parseGrade(gradeString: string, scaleHint?: ScaleId): ParsedGrade | undefined {
  if (!gradeString || typeof gradeString !== "string") return undefined;
  const raw = gradeString.trim();
  if (!raw) return undefined;

  const parts = tokenize(raw);
  if (parts.length === 0) return undefined;

  const hintScale = scaleHint ? getScale(scaleHint) : undefined;

  if (parts.length === 2) {
    const [t0, t1] = parts;

    const danger0 = checkDangerToken(t0);
    if (danger0) {
      const preferred = [
        ...(hintScale ? [hintScale] : []),
        ...(danger0.scale === "UKAdj" ? [ukTech] : [yds]),
      ];
      const primary1 = checkPrimaryToken(t1, preferred);
      if (primary1) {
        return {
          primary: primary1,
          danger: danger0,
          raw,
        };
      }
    }

    const danger1 = checkDangerToken(t1);
    if (danger1) {
      const preferred = [
        ...(hintScale ? [hintScale] : []),
        ...(danger1.scale === "UKAdj" ? [ukTech] : [yds]),
      ];
      const primary0 = checkPrimaryToken(t0, preferred);
      if (primary0) {
        return {
          primary: primary0,
          danger: danger1,
          raw,
        };
      }
    }

    const p0 = checkPrimaryToken(t0, hintScale ? [hintScale] : undefined);
    const p1 = checkPrimaryToken(t1, hintScale ? [hintScale] : undefined);
    if (p0) return { primary: p0, raw };
    if (p1) return { primary: p1, raw };
    return undefined;
  }

  if (parts.length === 1) {
    const t = parts[0];

    if (hintScale && hintScale.gradeType === "danger") {
      const danger = checkDangerToken(t);
      if (danger) return { danger, raw };
    }

    if (hintScale && hintScale.gradeType !== "danger") {
      const primary = checkPrimaryToken(t, [hintScale]);
      if (primary) return { primary, raw };
    }

    const danger = checkDangerToken(t);
    const primary = checkPrimaryToken(t);

    if (danger && !primary) {
      return { danger, raw };
    }
    if (primary && !danger) {
      return { primary, raw };
    }
    if (danger && primary) {
      if (hintScale && hintScale.id === danger.scale) {
        return { danger, raw };
      }
      if (hintScale && hintScale.id === primary.scale) {
        return { primary, raw };
      }
      if (/^E\d+/i.test(t)) {
        return { danger, raw };
      }
      return { primary, raw };
    }
  }

  let foundDanger: { grade: string; scale: DangerScaleId } | undefined;
  const remainingTokens: string[] = [];
  for (const part of parts) {
    if (!foundDanger) {
      const d = checkDangerToken(part);
      if (d) {
        foundDanger = d;
        continue;
      }
    }
    remainingTokens.push(part);
  }

  const preferred = [
    ...(hintScale ? [hintScale] : []),
    ...(foundDanger?.scale === "UKAdj" ? [ukTech] : [yds]),
  ];
  let foundPrimary: { grade: string; scale: ScaleId } | undefined;
  for (const part of remainingTokens) {
    const p = checkPrimaryToken(part, preferred);
    if (p) {
      foundPrimary = p;
      break;
    }
  }

  if (foundPrimary || foundDanger) {
    return {
      primary: foundPrimary,
      danger: foundDanger,
      raw,
    };
  }

  return undefined;
}

export const parseGradeWithDanger = parseGrade;
