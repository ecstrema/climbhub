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

import { existsSync } from "fs";
import { rm } from "fs/promises";
import { CLIMBING_DATA_FILE, OUT_DIR } from "./config.ts";
import { downloadClimbingData } from "./download.ts";
import { generateStaticAPI } from "./static-api-generator.ts";

import {
  DATA_DIR as REVERSE_GEOCODING_DATA_DIR,
  HIERARCHY_INDEX,
} from "@climbhub/reverse-geocoding-data";

const climbingDataFile = await downloadClimbingData(CLIMBING_DATA_FILE, {
  force: process.argv.includes("--refresh"),
});

// Keep the current API available if downloading the source data fails.
if (existsSync(OUT_DIR)) {
  console.log(`Deleting existing output directory at ${OUT_DIR}`);
  await rm(OUT_DIR, { recursive: true, force: true });
}

generateStaticAPI({
  geoIndexFile: HIERARCHY_INDEX,
  osmDataFiles: [climbingDataFile],
  outApiDirectory: OUT_DIR,
  reverseGeocodingDataDirectory: REVERSE_GEOCODING_DATA_DIR,
});
