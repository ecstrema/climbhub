import type { Coordinates, OverpassElement } from "./types";

export function getName(element: OverpassElement): string | null {
  return element.tags?.name || null;
}

/** TODO: return a real grade conversion and parsing library. I'm sure there must be existing things. */
export function getGrade(element: OverpassElement): string | null {
  const tags = element.tags;
  if (!tags) {
    return null;
  }
  return (
    tags["climbing:grade:french"] ||
    tags["climbing:grade:yds"] ||
    tags["climbing:grade:uiaa"] ||
    null
  );
}

export function getDescription(element: OverpassElement): string | null {
  const tags = element.tags;
  if (!tags) {
    return null;
  }

  return tags["description"] || null;
}

export function getCoordinates(element: OverpassElement): Coordinates | null {
  if (element.type === "node") return { lon: element.lon, lat: element.lat };
  if (element.center) return { lon: element.center.lon, lat: element.center.lat };

  // TODO: element may have a geometry. Is that actually happening?
  // @ts-ignore
  if (element.geometry?.length > 0) {
    // @ts-ignore
    return { lon: element.geometry[0].lon, lat: element.geometry[0].lat };
  }

  return null;
}
