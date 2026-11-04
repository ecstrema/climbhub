import type { Tags } from "osm-api";

type AnyTags = Record<string, string | undefined>;

export function getWebsite(tags: Tags): string | undefined {
  const t = tags as AnyTags;
  const value = (t.website || t["contact:website"] || t.url)?.trim();
  if (!value) return;
  const url = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  // Only http(s): avoids javascript: links from user-edited tags
  return /^https?:\/\//i.test(url) ? url : undefined;
}

/** `true`/`false` from `fee=yes|no`, undefined when unknown */
export function getFee(tags: Tags): boolean | undefined {
  const fee = (tags as AnyTags).fee?.trim().toLowerCase();
  if (fee === "yes") return true;
  if (fee === "no") return false;
  return undefined;
}

export function getFeeCharge(tags: Tags): string | undefined {
  return (tags as AnyTags).charge?.trim() || undefined;
}

export interface MapLink {
  id: string;
  label: string;
  href: string;
}

/** Links opening a location in the maps apps. `geo:` is handled by the installed apps (Android, CoMaps, Organic Maps, ...). */
export function getMapLinks(coordinates: { lat: number; lon: number }, name?: string): MapLink[] {
  const { lat, lon } = coordinates;
  const ll = `${lat},${lon}`;
  const label = name ? encodeURIComponent(name) : "";
  return [
    { id: "geo", label: "Default maps app", href: `geo:${ll}${label ? `?q=${ll}(${label})` : ""}` },
    { id: "apple", label: "Apple Maps", href: `https://maps.apple.com/?ll=${ll}&q=${label || ll}` },
    { id: "google", label: "Google Maps", href: `https://www.google.com/maps/search/?api=1&query=${ll}` },
    { id: "osm", label: "OpenStreetMap", href: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}` },
    { id: "comaps", label: "CoMaps / Organic Maps", href: `om://map?ll=${ll}${label ? `&n=${label}` : ""}` },
  ];
}
