if (!Map.prototype.getOrInsertComputed) {
  Map.prototype.getOrInsertComputed = function (key, callback) {
    if (this.has(key)) {
      return this.get(key);
    }
    this.set(key, callback(key));
  };
}
if (!Map.prototype.getOrInsert) {
  Map.prototype.getOrInsert = function (key, value) {
    if (this.has(key)) {
      return this.get(key);
    }
    this.set(key, value);
  };
}

import { join } from "path";
import { generateStaticAPI } from "./static-api-generator.ts";

const dir = import.meta.dirname;

export const REVERSE_GEOCODING_DATA_DIR = join(dir, "../reverse-geocoding-data/data");
export const OSM_DATA_FILE = join(dir, "climbing-data.json");
export const GEO_INDEX_FILE = join(REVERSE_GEOCODING_DATA_DIR, "hierarchy-index.json");

export const OUT_API_DIR = join(dir, "../data");

generateStaticAPI({
  geoIndexFile: GEO_INDEX_FILE,
  osmDataFile: OSM_DATA_FILE,
  outApiDirectory: OUT_API_DIR,
  reverseGeocodingDataDirectory: REVERSE_GEOCODING_DATA_DIR,
});
