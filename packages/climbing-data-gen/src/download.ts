import { existsSync } from "fs";
import { writeFile } from "fs/promises";
import { USER_AGENT } from "reverse-geocoding-data";

const query = `
[out:json][timeout:300];
// Define Quebec as the search area
area["ISO3166-2"="CA-QC"]["admin_level"="4"]->.searchArea;

// Find all nodes, ways, and relations tagged with sport=climbing
nwr["sport"="climbing"](area.searchArea);

// Union block: take the current results (._) and recursively get all their children (>)
(._; >;);

// Output with metadata (this includes the timestamp, user, and changeset)
out meta;`;

export async function downloadOSMData(outputFilePath: string, remainingTries = 10) {
  // Check if the file already exists
  if (existsSync(outputFilePath)) {
    console.log(`OSM data file already exists at ${outputFilePath}. Skipping download.`);
    return;
  }

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: query,
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
  if (!res.ok) {
    // sleep for 10 seconds and retry if we have remaining tries
    if (remainingTries > 0) {
      console.warn(
        `Failed to download OSM data: ${res.status} ${res.statusText}. Retrying in 10 seconds... (${remainingTries} tries left)`,
      );
      await new Promise((resolve) => setTimeout(resolve, 10000));
      return downloadOSMData(outputFilePath, remainingTries - 1);
    }
    throw new Error(`Failed to download OSM data: ${res.status} ${res.statusText}`);
  }

  const osmData = await res.json();
  await writeFile(outputFilePath, JSON.stringify(osmData));
  console.log(`OSM data downloaded and saved to ${outputFilePath}`);
}
