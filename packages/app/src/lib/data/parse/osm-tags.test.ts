import { describe, expect, it } from "vitest";
import type { OsmFeature } from "osm-api";
import { featureToTypeOSM } from "./osm-tags";

function feature(tags: Record<string, string>): OsmFeature {
  return { type: "node", id: 1, lat: 0, lon: 0, tags } as OsmFeature;
}

describe("featureToTypeOSM", () => {
  it.each([
    "route_bottom",
    "route_top",
    "route",
    "route_start",
    "boulder",
    "bouldering",
    "route; boulder",
    "abseil_route",
    "abseil",
    "toprope",
    "drytooling",
  ])("classifies climbing=%s as a route", (climbing) => {
    expect(featureToTypeOSM(feature({ climbing }))).toBe("route");
  });

  it.each(["sports_centre", "sports_hall", "fitness_centre", "sport_centre"])(
    "classifies sport=climbing at leisure=%s as a gym",
    (leisure) => {
      expect(featureToTypeOSM(feature({ leisure, sport: "climbing" }))).toBe("gym");
    },
  );

  it("classifies other climbing sport features as areas", () => {
    expect(featureToTypeOSM(feature({ sport: "climbing" }))).toBe("area");
  });

  it("keeps non-climbing features unclassified", () => {
    expect(featureToTypeOSM(feature({ sport: "hiking" }))).toBeUndefined();
  });
});
