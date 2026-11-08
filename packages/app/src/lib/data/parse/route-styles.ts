export const ROUTE_STYLE_COLORS: Record<string, string> = {
  sport: "#3b82f6",
  boulder: "#a855f7",
  trad: "#f59e0b",
  aid: "#ef4444",
  ice: "#06b6d4",
  mixed: "#14b8a6",
  dry: "#0d9488",
  toprope: "#ec4899",
  deepwater: "#0284c7",
  other: "#64748b",
};

export const ROUTE_STYLE_LABELS: Record<string, string> = {
  sport: "Sport",
  boulder: "Boulder",
  trad: "Trad",
  aid: "Aid",
  ice: "Ice",
  mixed: "Mixed",
  dry: "Dry",
  toprope: "Top rope",
  deepwater: "Deep-water solo",
  other: "Other",
};

export function extractRouteStyle(tags: Record<string, string>): string {
  if (tags["climbing:boulder"] === "yes" || tags.climbing === "boulder" || tags.climbing === "bouldering") {
    return "boulder";
  }
  if (tags["climbing:aid"] === "yes" || tags["climbing:grade:aid"]) {
    return "aid";
  }
  if (tags["climbing:ice"] === "yes" || tags["climbing:grade:ice"]) {
    return "ice";
  }
  if (tags["climbing:mixed"] === "yes" || tags["climbing:grade:mixed"]) {
    return "mixed";
  }
  if (tags["climbing:dry"] === "yes" || tags["climbing:grade:dry"]) {
    return "dry";
  }
  if (tags["climbing:trad"] === "yes") {
    return "trad";
  }
  if (tags["climbing:sport"] === "yes") {
    return "sport";
  }
  if (tags["climbing:toprope"] === "yes") {
    return "toprope";
  }
  if (tags["climbing:deepwater"] === "yes") {
    return "deepwater";
  }
  return "sport";
}

function cross2D(o: [number, number], a: [number, number], b: [number, number]): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

export function buildSectorContour(points: [number, number][], bufferDist = 0.0003): [number, number][] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    const [cx, cy] = points[0]!;
    const ring: [number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ring.push([cx + bufferDist * Math.cos(a), cy + bufferDist * Math.sin(a)]);
    }
    return ring;
  }
  if (points.length === 2) {
    const [p1, p2] = points;
    const dx = p2![0] - p1![0];
    const dy = p2![1] - p1![1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * bufferDist;
    const ny = (dx / len) * bufferDist;
    return [
      [p1![0] + nx, p1![1] + ny],
      [p2![0] + nx, p2![1] + ny],
      [p2![0] - nx, p2![1] - ny],
      [p1![0] - nx, p1![1] - ny],
      [p1![0] + nx, p1![1] + ny],
    ];
  }

  const pts = [...points].sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross2D(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!;
    while (upper.length >= 2 && cross2D(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  const hull = lower.concat(upper);

  const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
  const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
  const expanded: [number, number][] = hull.map(([x, y]) => {
    const vx = x - cx;
    const vy = y - cy;
    const dist = Math.hypot(vx, vy) || 1;
    return [x + (vx / dist) * bufferDist, y + (vy / dist) * bufferDist];
  });
  if (expanded.length > 0) {
    expanded.push([expanded[0]![0], expanded[0]![1]]);
  }
  return expanded;
}

export const FEATURE_COLORS = {
  cliff: { fill: "#78350f", stroke: "#fde68a", label: "Cliff" },
  area: { fill: "#ea580c", stroke: "#ffffff", label: "Area / Crag" },
  gym: { fill: "#059669", stroke: "#ffffff", label: "Gym" },
} as const;
