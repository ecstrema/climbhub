if (!Map.prototype.getOrInsertComputed) {
  Map.prototype.getOrInsertComputed = function (key, callback) {
    if (this.has(key)) {
      return this.get(key);
    }
    this.set(key, callback(key));
  };
}

import { join, dirname } from "path";
import { generateStaticAPI } from "./static-api-generator.ts";

const filename = typeof __filename === "string" ? __filename : "src/main.ts";
const dir = dirname(filename);

export const REVERSE_GEOCODING_DATA_DIR = join(dir, "../reverse-geocoding-data/data");
export const OSM_DATA_FILE = join(dir, "climbing-data.json");
export const GEO_INDEX_FILE = join(REVERSE_GEOCODING_DATA_DIR, "hierarchy-index.json");

export const OUT_API_DIR = join(dir, "../../../static/api");

generateStaticAPI({
  geoIndexFile: GEO_INDEX_FILE,
  osmDataFile: OSM_DATA_FILE,
  outApiDirectory: OUT_API_DIR,
  reverseGeocodingDataDirectory: REVERSE_GEOCODING_DATA_DIR,
});
