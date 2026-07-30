import { join } from "path";

let dirname = import.meta.dirname;

// When building with SvelteKit, the import.meta.dirname will point to the .svelte-kit directory, which is not where we want to store our output files. We need to adjust the path to point to the climbing-data-gen package instead.
if (dirname.includes(".svelte-kit")) {
  const svelteKitIndex = dirname.indexOf(".svelte-kit");
  const appDir = dirname.slice(0, svelteKitIndex);
  dirname = join(appDir, "../climbing-data-gen/src");
}

export const OSM_DATA_FILE = join(dirname, "climbing-data.json");
export const OUT_DIR = join(dirname, "../build");
