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

import { OSM_DATA_FILE, OUT_DIR } from "./config.ts";
import { generateStaticAPI } from "./static-api-generator.ts";

import { HIERARCHY_INDEX, OUTPUT_DIR as REVERSE_GEOCODING_DATA_DIR } from "reverse-geocoding-data";

generateStaticAPI({
  geoIndexFile: HIERARCHY_INDEX,
  osmDataFile: OSM_DATA_FILE,
  outApiDirectory: OUT_DIR,
  reverseGeocodingDataDirectory: REVERSE_GEOCODING_DATA_DIR,
});
