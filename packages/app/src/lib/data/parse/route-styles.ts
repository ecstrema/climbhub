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

export const FEATURE_COLORS = {
  cliff: { fill: "#78350f", stroke: "#fde68a", label: "Cliff" },
  area: { fill: "#ea580c", stroke: "#ffffff", label: "Area / Crag" },
  gym: { fill: "#059669", stroke: "#ffffff", label: "Gym" },
} as const;
