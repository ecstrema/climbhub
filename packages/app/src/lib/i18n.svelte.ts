import { loadLocale } from "wuchale/load-utils";
import { locales } from "../locales/data.js";
import "../locales/main.loader.svelte.js";
import "../locales/regions.loader.svelte.js";

export type Locale = (typeof locales)[number];
export { locales };

/** Names are not translated: each language is shown in itself */
export const localeNames: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  pt: "Português",
};

const STORAGE_KEY = "climbhub-locale";
const isLocale = (value: string | null | undefined): value is Locale => locales.includes(value as Locale);

export const i18n = $state<{ locale: Locale }>({ locale: "en" });

export async function setLocale(locale: Locale) {
  await loadLocale(locale);
  i18n.locale = locale;
  document.documentElement.lang = locale;
  localStorage.setItem(STORAGE_KEY, locale);
}

/** The saved language, else the one of the browser. Loaded after the English prerendered pages hydrated. */
export async function initLocale() {
  const stored = localStorage.getItem(STORAGE_KEY);
  const preferred = isLocale(stored) ? stored : navigator.languages.map((l) => l.split("-")[0]).find(isLocale);
  if (preferred && preferred !== i18n.locale) await setLocale(preferred);
}
