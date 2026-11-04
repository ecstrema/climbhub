import { browser } from "$app/env";

const STORAGE_KEY = "climbhub:low-data";

function initialValue(): boolean {
  if (!browser) return false;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) return stored === "true";
  return (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
}

class Settings {
  /** When enabled, the whole dataset is never downloaded automatically: pages fetch only what they show. */
  #lowData = $state(initialValue());

  get lowData() {
    return this.#lowData;
  }

  set lowData(value: boolean) {
    this.#lowData = value;
    if (browser) localStorage.setItem(STORAGE_KEY, String(value));
  }
}

export const settings = new Settings();
