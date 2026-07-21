import type { DataJSON } from "./types";
import { getName as getNameOSM } from "./osm-tags";

/** Folders use .name, OSM elements usually store their name in .tags.name */
export function getName(element: DataJSON) {
  if (element.type === "geographic") {
    return element.name;
  }
  return getNameOSM(element);
}
