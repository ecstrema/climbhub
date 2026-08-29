import type { DataJSONRecord } from "./types";
import { featureToTypeOSM, getNameOSM } from "./osm-tags";
import type { DataJSON } from "@climbhub/climbing-data-gen";

/** Folders use .name, OSM elements usually store their name in .tags.name */
export function getName(element: DataJSON) {
  if (element.type === "geographic") {
    return element.name;
  }
  return getNameOSM(element.tags ?? {});
}

export function dataTreeFromJsonRecord(data: DataJSONRecord) {
  return Object.fromEntries(
    Object.entries(data).map(([key, val]) => [
      key,
      {
        feature: val,
      },
    ]),
  );
}

export function featureToType(
  feature: DataJSON,
): "geographic" | "route" | "area" | "gym" | undefined {
  if (feature.type === "geographic") return "geographic";

  return featureToTypeOSM(feature);
}
