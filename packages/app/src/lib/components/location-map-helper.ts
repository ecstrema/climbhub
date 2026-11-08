import { resolve } from "$app/paths";
import type { OsmFeature } from "osm-api";
import type { MapElementFeature } from "#lib/data/db/types.js";
import {
  extractRouteStyle,
  FEATURE_COLORS,
  ROUTE_STYLE_COLORS,
  ROUTE_STYLE_LABELS,
} from "#lib/data/parse/route-styles.js";
import { getCoordinates, getGrade } from "#lib/data/parse/osm-tags.js";
import { getColorFromGrade } from "#lib/data/network/grade.js";
import type { LayerSpecification } from "maplibre-gl";

export const VECTOR_STYLE = "https://tiles.openfreemap.org/styles/liberty";

export function featureToMapElement(slug: string, feature: OsmFeature): MapElementFeature | undefined {
  const coords = getCoordinates(feature);
  if (!coords) return undefined;
  const { lat, lon } = coords;

  const tags = feature.tags ?? {};
  const isCliff = tags.natural === "cliff";
  const isRoute =
    feature.type === "node" &&
    (tags.climbing === "route_bottom" ||
      tags.climbing === "route" ||
      tags.climbing === "route_top" ||
      tags.climbing === "route_start" ||
      tags.climbing === "abseil_route" ||
      tags.climbing === "toprope" ||
      tags.climbing === "drytooling" ||
      (tags.climbing !== "area" &&
        tags.climbing !== "crag" &&
        (tags["climbing:sport"] || tags["climbing:boulder"] || tags["climbing:trad"] || tags["climbing:grade"])));

  let elementType: MapElementFeature["properties"]["elementType"] = isCliff
    ? "cliff"
    : isRoute
      ? "route"
      : tags.sport === "climbing" && (tags.leisure === "sports_centre" || tags.leisure === "pitch")
        ? "gym"
        : "area";

  let fillColor = "#94a3b8";
  let strokeColor = "#ffffff";
  let routeStyle: string | undefined;
  let gradeStr: string | undefined;

  if (isCliff) {
    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [lon - 0.00015, lat],
          [lon + 0.00015, lat],
        ],
      },
      properties: {
        slug,
        name: tags.name ?? "Cliff",
        elementType: "cliff",
        fillColor: "transparent",
        strokeColor: FEATURE_COLORS.cliff.fill,
        href: resolve("/world/[...slug]", { slug }),
      },
    };
  }

  if (elementType === "route") {
    routeStyle = extractRouteStyle(tags);
    strokeColor = ROUTE_STYLE_COLORS[routeStyle] ?? "#64748b";
    const gradeObj = getGrade(tags)?.v;
    if (gradeObj) {
      gradeStr = gradeObj.v;
      if (gradeObj.scale !== "unknown") {
        fillColor = getColorFromGrade(gradeObj.v, gradeObj.scale);
      }
    }
  } else if (elementType === "area") {
    fillColor = FEATURE_COLORS.area.fill;
    strokeColor = FEATURE_COLORS.area.stroke;
  } else if (elementType === "gym") {
    fillColor = FEATURE_COLORS.gym.fill;
    strokeColor = FEATURE_COLORS.gym.stroke;
  }

  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lon, lat] },
    properties: {
      slug,
      name: tags.name ?? "Unnamed",
      elementType,
      routeStyle,
      grade: gradeStr,
      fillColor,
      strokeColor,
      href: resolve("/world/[...slug]", { slug }),
    },
  };
}

function cross2D(o: [number, number], a: [number, number], b: [number, number]): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

export const SECTOR_BUFFER_1M = 0.00001; // ~1 meter in degrees

export function buildSectorContour(points: [number, number][], bufferDist = SECTOR_BUFFER_1M): [number, number][] {
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

export function formatPopupHtml(props: MapElementFeature["properties"]): string {
  const title = props.name || "Unnamed";
  let badge = "";
  if (props.elementType === "route") {
    const gradeText = props.grade ? ` · ${props.grade}` : "";
    const styleText = props.routeStyle ? `${ROUTE_STYLE_LABELS[props.routeStyle] ?? props.routeStyle} route` : "Route";
    badge = `${styleText}${gradeText}`;
  } else if (props.elementType === "cliff") {
    badge = "Cliff";
  } else if (props.elementType === "area") {
    badge = "Area / Crag";
  } else if (props.elementType === "sector") {
    badge = "Sector";
  } else if (props.elementType === "gym") {
    badge = "Gym";
  }

  return `<div class="font-semibold text-xs">${title}</div>${badge ? `<div class="text-[11px] opacity-80">${badge}</div>` : ""}`;
}

export const CLIMBING_LAYERS: LayerSpecification[] = [
  {
    id: "sectors-contour",
    type: "line",
    source: "climbing-elements",
    filter: ["==", ["get", "elementType"], "sector"],
    paint: {
      "line-color": "#64748b",
      "line-dasharray": [4, 3],
      "line-width": 1.5,
    },
  },
  {
    id: "sectors-label",
    type: "symbol",
    source: "climbing-elements",
    filter: ["==", ["get", "elementType"], "sector"],
    layout: {
      "symbol-placement": "line",
      "text-field": ["get", "name"],
      "text-size": 11,
      "text-offset": [0, -0.6],
      "text-allow-overlap": false,
      "text-ignore-placement": false,
    },
    paint: {
      "text-color": "#475569",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.5,
    },
  },
  {
    id: "cliffs",
    type: "line",
    source: "climbing-elements",
    filter: ["==", ["get", "elementType"], "cliff"],
    paint: {
      "line-color": "#78350f",
      "line-width": 2.5,
    },
  },
  {
    id: "areas",
    type: "circle",
    source: "climbing-elements",
    filter: ["==", ["get", "elementType"], "area"],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 3, 9, 5, 14, 7],
      "circle-color": ["get", "fillColor"],
      "circle-stroke-color": ["get", "strokeColor"],
      "circle-stroke-width": 1.5,
    },
  },
  {
    id: "gyms",
    type: "circle",
    source: "climbing-elements",
    filter: ["==", ["get", "elementType"], "gym"],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 3, 9, 5, 14, 7],
      "circle-color": ["get", "fillColor"],
      "circle-stroke-color": ["get", "strokeColor"],
      "circle-stroke-width": 1.5,
    },
  },
  {
    id: "routes",
    type: "circle",
    source: "climbing-elements",
    minzoom: 7,
    filter: ["==", ["get", "elementType"], "route"],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 2.5, 12, 4, 15, 5.5, 18, 7.5],
      "circle-color": ["get", "fillColor"],
      "circle-stroke-color": ["get", "strokeColor"],
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 8, 1, 14, 1.5, 17, 2],
    },
  },
  {
    id: "selected-ring",
    type: "circle",
    source: "climbing-elements",
    filter: ["==", ["get", "slug"], ""],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 6, 12, 9, 15, 12, 18, 15],
      "circle-color": "transparent",
      "circle-stroke-color": "#2563eb",
      "circle-stroke-width": 2.5,
    },
  },
  {
    id: "selected-sector",
    type: "line",
    source: "climbing-elements",
    filter: ["all", ["==", ["get", "elementType"], "sector"], ["==", ["get", "slug"], ""]],
    paint: {
      "line-color": "#2563eb",
      "line-width": 3,
    },
  },
  {
    id: "selected-sector-label",
    type: "symbol",
    source: "climbing-elements",
    filter: ["all", ["==", ["get", "elementType"], "sector"], ["==", ["get", "slug"], ""]],
    layout: {
      "symbol-placement": "line",
      "text-field": ["get", "name"],
      "text-size": 12,
      "text-offset": [0, -0.6],
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: {
      "text-color": "#1d4ed8",
      "text-halo-color": "#ffffff",
      "text-halo-width": 2,
    },
  },
  {
    id: "route-labels",
    type: "symbol",
    source: "climbing-elements",
    minzoom: 14,
    filter: ["==", ["get", "elementType"], "route"],
    layout: {
      "text-field": ["get", "name"],
      "text-size": 11,
      "text-anchor": "bottom",
      "text-offset": [0, -0.7],
      "text-optional": true,
      "text-allow-overlap": false,
      "text-ignore-placement": false,
    },
    paint: {
      "text-color": "#1e293b",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.5,
    },
  },
];
