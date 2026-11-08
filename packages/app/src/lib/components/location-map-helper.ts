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
  } else if (elementType === "cliff") {
    fillColor = FEATURE_COLORS.cliff.fill;
    strokeColor = FEATURE_COLORS.cliff.stroke;
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
  } else if (props.elementType === "gym") {
    badge = "Gym";
  }

  return `<div class="font-semibold text-xs">${title}</div>${badge ? `<div class="text-[11px] opacity-80">${badge}</div>` : ""}`;
}

export const CLIMBING_LAYERS: LayerSpecification[] = [
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
    id: "cliffs",
    type: "circle",
    source: "climbing-elements",
    filter: ["==", ["get", "elementType"], "cliff"],
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 2.5, 11, 4.5, 15, 6.5],
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
];
