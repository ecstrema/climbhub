import { describe, expect, it } from "vitest";
import { extractRouteStyle, FEATURE_COLORS, ROUTE_STYLE_COLORS } from "./route-styles";
import { featureToMapElement } from "../../components/location-map-helper";
import type { OsmFeature } from "osm-api";

describe("route-styles", () => {
  it("extracts route styles correctly from tags", () => {
    expect(extractRouteStyle({ "climbing:boulder": "yes" })).toBe("boulder");
    expect(extractRouteStyle({ climbing: "boulder" })).toBe("boulder");
    expect(extractRouteStyle({ "climbing:aid": "yes" })).toBe("aid");
    expect(extractRouteStyle({ "climbing:grade:aid": "A2" })).toBe("aid");
    expect(extractRouteStyle({ "climbing:ice": "yes" })).toBe("ice");
    expect(extractRouteStyle({ "climbing:trad": "yes" })).toBe("trad");
    expect(extractRouteStyle({ "climbing:sport": "yes" })).toBe("sport");
    expect(extractRouteStyle({ "climbing:toprope": "yes" })).toBe("toprope");
    expect(extractRouteStyle({})).toBe("sport");
  });

  it("has distinct stroke colors for all route styles", () => {
    expect(ROUTE_STYLE_COLORS.sport).toBe("#3b82f6");
    expect(ROUTE_STYLE_COLORS.boulder).toBe("#a855f7");
    expect(ROUTE_STYLE_COLORS.trad).toBe("#f59e0b");
    expect(ROUTE_STYLE_COLORS.aid).toBe("#ef4444");
    expect(ROUTE_STYLE_COLORS.ice).toBe("#06b6d4");
  });

  it("has feature colors for cliffs, areas, and gyms", () => {
    expect(FEATURE_COLORS.cliff.fill).toBe("#78350f");
    expect(FEATURE_COLORS.area.fill).toBe("#ea580c");
    expect(FEATURE_COLORS.gym.fill).toBe("#059669");
  });

  it("converts cliff feature to map element with cliff styling", () => {
    const cliffNode = {
      type: "node",
      id: 12345,
      lat: 45.0,
      lon: 5.0,
      tags: {
        natural: "cliff",
        name: "Grand Cliff",
      },
    } as unknown as OsmFeature;
    const el = featureToMapElement("world/europe/france/grand-cliff", cliffNode);
    expect(el).toBeDefined();
    expect(el?.properties.elementType).toBe("cliff");
    expect(el?.properties.fillColor).toBe(FEATURE_COLORS.cliff.fill);
    expect(el?.properties.strokeColor).toBe(FEATURE_COLORS.cliff.stroke);
  });

  it("converts route feature with grade to map element with grade fill and style stroke", () => {
    const routeNode = {
      type: "node",
      id: 67890,
      lat: 45.1,
      lon: 5.1,
      tags: {
        name: "Voie Normale",
        climbing: "route_bottom",
        "climbing:sport": "yes",
        "climbing:grade:french": "6a",
      },
    } as unknown as OsmFeature;
    const el = featureToMapElement("world/europe/france/crag/voie-normale", routeNode);
    expect(el).toBeDefined();
    expect(el?.properties.elementType).toBe("route");
    expect(el?.properties.routeStyle).toBe("sport");
    expect(el?.properties.strokeColor).toBe(ROUTE_STYLE_COLORS.sport);
    expect(el?.properties.grade).toBe("6a");
    expect(el?.properties.fillColor).toContain("hsl(");
  });
});
