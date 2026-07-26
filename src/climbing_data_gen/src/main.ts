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

import { GEO_INDEX_FILE, OSM_DATA_FILE, OUT_API_DIR, REVERSE_GEOCODING_DATA_DIR } from "./const.ts";
import { generateStaticAPI } from "./static-api-generator.ts";

generateStaticAPI({
  geoIndexFile: GEO_INDEX_FILE,
  osmDataFile: OSM_DATA_FILE,
  outApiDirectory: OUT_API_DIR,
  reverseGeocodingDataDirectory: REVERSE_GEOCODING_DATA_DIR,
});
