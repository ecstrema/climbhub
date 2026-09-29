import type { AlternateNamesMapping, GradeMapping } from "./types";

/**
 * Builds a normalize() function from a scale's gradeMapping and (optional) alternateNames.
 * Callers are expected to apply their own scale-specific casing (e.g. lowercase for French
 * routes, uppercase for Fontainebleau) to `grade` before calling the returned function, since
 * that convention differs per scale — see each scale file's own `normalize`.
 */
export function normalizeFromGradeMappings(
  gradeMapping: GradeMapping,
  alternateNames?: AlternateNamesMapping,
): (grade: string) => string | undefined {
  return (grade: string): string | undefined => {
    const trimmed = grade.trim();
    if (gradeMapping.has(trimmed)) return trimmed;

    const alternate = alternateNames?.get(trimmed);
    if (alternate !== undefined && gradeMapping.has(alternate)) return alternate;

    return undefined;
  };
}

/**
 * Inverts a GradeMapping into a plain array indexed by rank — grade->number is a Map (grades
 * are strings), but number->grade is this "big table" instead: `table[42]` is the grade at
 * rank 42, or undefined if no grade sits at exactly that rank. Ranks aren't necessarily dense
 * (there can be gaps), so this array is sparse; TS still types every read as
 * `string | undefined` (see getGradeFromReference for how callers should handle that).
 */
export function buildReverseTable(gradeMapping: GradeMapping): (string | undefined)[] {
  const table: (string | undefined)[] = [];
  for (const [grade, rank] of gradeMapping) {
    table[rank] = grade;
  }
  return table;
}

/**
 * Roman numerals — shared by any scale whose alternateNames include a Roman-numeral form
 * (UIAA and Polish are Arabic-canonical with Roman alternates; Saxon is Roman-canonical with
 * Arabic alternates).
 */
const ROMAN_VALUES: [string, number][] = [
  ["L", 50],
  ["XL", 40],
  ["X", 10],
  ["IX", 9],
  ["V", 5],
  ["IV", 4],
  ["I", 1],
];

export function arabicToRoman(n: number): string {
  if (!Number.isInteger(n) || n <= 0 || n > 899) {
    throw new Error(`arabicToRoman: ${n} is out of range`);
  }
  let remaining = n;
  let result = "";
  for (const [symbol, value] of ROMAN_VALUES) {
    while (remaining >= value) {
      result += symbol;
      remaining -= value;
    }
  }
  return result;
}

/** Since some scales use roman numerals, this is provided for convenience. */
export function romanToArabic(roman: string): number | undefined {
  let value = 0;
  let remaining = roman.toUpperCase();
  for (const [symbol, symbolValue] of ROMAN_VALUES) {
    while (remaining.startsWith(symbol)) {
      value += symbolValue;
      remaining = remaining.slice(symbol.length);
    }
  }
  return remaining === "" && value > 0 ? value : undefined;
}

/**
 * Builds Roman<->Arabic alternate names for the "-", "", "+" forms of every whole number from
 * 1 to maxNumber, in whichever direction isn't the scale's own canonical form. E.g. for a
 * canonicallyArabic scale (UIAA), `numeralAlternateNames(14, true)` maps "IV+" -> "4+".
 * Compound transition grades (e.g. "6-/6") aren't covered — Roman-numeral spellings of those
 * are rare enough in practice that hand-listing every one isn't worth the complexity.
 */
export function numeralAlternateNames(
  maxNumber: number,
  canonicalIsArabic: boolean,
): AlternateNamesMapping {
  const alternates: AlternateNamesMapping = new Map();
  for (let n = 1; n <= maxNumber; n++) {
    const arabic = String(n);
    const roman = arabicToRoman(n);
    for (const suffix of ["-", "", "+"]) {
      if (canonicalIsArabic) {
        alternates.set(`${roman}${suffix}`, `${arabic}${suffix}`);
      } else {
        alternates.set(`${arabic}${suffix}`, `${roman}${suffix}`);
      }
    }
  }
  return alternates;
}
