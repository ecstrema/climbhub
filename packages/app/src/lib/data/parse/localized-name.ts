import type { DataJSON } from "@climbhub/climbing-data-gen";
import { getName } from "./data.js";
import { regionNames } from "../region-names.svelte.js";
import { i18n } from "#lib/i18n.svelte.js";

let cache: { locale: string; names: string[] } | undefined;

/** Like {@link getName}, with the regions in the current language. Not for the db worker. */
export function getLocalizedName(element: DataJSON | undefined) {
  if (element?.type === "geographic" && element.nameId !== undefined) {
    // Reading the locale makes the callers react to its changes
    if (cache?.locale !== i18n.locale) cache = { locale: i18n.locale, names: regionNames() };
    return cache.names[element.nameId] ?? element.name;
  }
  return element && getName(element);
}
