import { join } from "path";

const dir = import.meta.dirname;

export const REVERSE_GEOCODING_DATA_DIR = join(dir, "../reverse-geocoding-data/data");
export const OSM_DATA_FILE = join(dir, "climbing-data.json");
export const GEO_INDEX_FILE = join(REVERSE_GEOCODING_DATA_DIR, "hierarchy-index.json");

export const OUT_API_DIR = join(dir, "../data");
