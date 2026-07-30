import { join } from "path";

let dirname = import.meta.dirname;

// during build, split dirname by / and \\, then pop until we find .svelte-kit, then join with ../climbing-data-gen/src and we are back at the right place
if (dirname.includes(".svelte-kit")) {
  const parts = dirname.split(/[/\\]/);
  while (parts.length > 0 && parts.pop() !== ".svelte-kit") {}
  dirname = join(...parts, "../climbing-data-gen/src");
}

export const OSM_DATA_FILE = join(dirname, "climbing-data.json");
export const OUT_DIR = join(dirname, "../build");
