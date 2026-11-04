export const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

/** Minutes since midnight, `end` may be above 1440 for ranges closing after midnight */
export interface TimeRange {
  start: number;
  end: number;
}

export type WeekHours = TimeRange[][];

const emptyWeek = (): WeekHours => DAYS.map(() => []);

function parseTime(s: string): number | undefined {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  return minutes <= 24 * 60 ? minutes : undefined;
}

function parseDays(s: string): number[] | undefined {
  const days = new Set<number>();
  for (const part of s.split(",")) {
    const p = part.trim();
    if (p === "PH" || p === "SH") continue;
    const [a, b] = p.split("-").map((d) => DAYS.indexOf(d as (typeof DAYS)[number]));
    if (a === undefined || a < 0) return;
    if (p.includes("-")) {
      if (b === undefined || b < 0) return;
      for (let i = a; ; i = (i + 1) % 7) {
        days.add(i);
        if (i === b) break;
      }
    } else {
      days.add(a);
    }
  }
  return [...days];
}

/**
 * Parses the common subset of the OSM `opening_hours` syntax: `24/7`, day ranges and time ranges.
 * Returns undefined for anything else (months, weeks, sunrise, ...).
 */
export function parseOpeningHours(value: string | undefined): WeekHours | undefined {
  const text = value?.trim();
  if (!text) return;
  const week = emptyWeek();
  if (text === "24/7") return week.map(() => [{ start: 0, end: 1440 }]);

  for (const rule of text.split(";")) {
    const r = rule.trim();
    if (!r) continue;
    const m = r.match(/^(?:([A-Za-z,\- ]+?)\s+)?([\d:,\- ]+|off|closed)$/);
    if (!m) return;
    const days = m[1] ? parseDays(m[1].replace(/\s+/g, "")) : [0, 1, 2, 3, 4, 5, 6];
    if (!days) return;
    const times = m[2]!.trim();
    // A later rule overrides the days it names
    for (const d of days) week[d] = [];
    if (times === "off" || times === "closed") continue;
    const ranges: TimeRange[] = [];
    for (const range of times.split(",")) {
      const [from, to] = range.trim().split("-").map((t) => parseTime(t.trim()));
      if (from === undefined || to === undefined) return;
      ranges.push({ start: from, end: to <= from ? to + 1440 : to });
    }
    for (const d of days) week[d] = ranges;
  }
  return week;
}

export function formatTime(minutes: number): string {
  const m = minutes % 1440 === 0 && minutes > 0 ? 1440 : minutes % 1440;
  const h = Math.floor(m / 60);
  return `${String(h % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
