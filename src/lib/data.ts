import type { DataJSON, DataJSONRecord } from "./types";
import { getName as getNameOSM } from "./osm-tags";

/** Folders use .name, OSM elements usually store their name in .tags.name */
export function getName(element: DataJSON) {
  if (element.type === "geographic") {
    return element.name;
  }
  return getNameOSM(element);
}

export function recursiveDataJSONFromRecord(record: DataJSONRecord) {
  return Object.fromEntries(
    Object.entries(record).map(([key, val]) => [
      key,
      {
        own: val,
      },
    ]),
  );
}
