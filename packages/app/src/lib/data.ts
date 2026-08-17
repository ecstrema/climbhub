import type { DataJSONRecord } from "./types";
import { getNameOSM, processOSM, type ProcessedOSMData } from "./osm-tags";
import type { DataJSON } from "climbing-data-gen";

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
        own: val,
      },
    ]),
  );
}

export interface GeographicData {
  type: "geographic";
  name: string;
}

export type ProcessedData = GeographicData | ProcessedOSMData;

export function process(element: DataJSON): ProcessedData | null {
  if (element.type === "geographic") {
    return {
      type: "geographic",
      name: element.name,
    };
  }

  return processOSM(element);
}
