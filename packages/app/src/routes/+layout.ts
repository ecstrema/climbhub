// since there's no dynamic data here, we can prerender
// it so that it gets served as a static asset in production
export const prerender = true;

import { loadLocale } from "wuchale/load-utils";
import "../locales/main.loader.svelte.js";
import "../locales/regions.loader.svelte.js";

// The pages are prerendered in English, the language of the user is loaded once hydrated
export const load = async () => {
  await loadLocale("en");
};
