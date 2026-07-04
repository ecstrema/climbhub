import osmtogeojson from "osmtogeojson";
import * as yaml from "js-yaml";
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "fs";
import { join, resolve, dirname, basename } from "path";
import { BoundingBox, IndexNode, YamlConfig } from "./types";
import { DATA_DIR, OUTPUT_INDEX, USER_AGENT } from "./config";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function mergeBbox(b1: BoundingBox, b2: BoundingBox): BoundingBox {
  if (!b1) return b2;
  if (!b2) return b1;
  return {
    x0: Math.min(b1.x0, b2.x0),
    x1: Math.max(b1.x1, b2.x1),
    y0: Math.min(b1.y0, b2.y0),
    y1: Math.max(b1.y1, b2.y1),
  };
}

function calculateGeoJsonBbox(geojson: any): BoundingBox {
  let bbox: BoundingBox = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  function processCoordinates(coords: any) {
    if (typeof coords[0] === "number") {
      const [lon, lat] = coords;
      bbox = mergeBbox(bbox, { x0: lon, x1: lon, y0: lat, y1: lat });
    } else {
      for (const sub of coords) {
        processCoordinates(sub);
      }
    }
  }
  if (geojson.type === "FeatureCollection" && Array.isArray(geojson.features)) {
    for (const feature of geojson.features) {
      if (feature.geometry?.coordinates) processCoordinates(feature.geometry.coordinates);
    }
  }
  return bbox;
}

function scanDirectoryForConfigs(
  dir: string,
  configs = new Map<string, YamlConfig>(),
): Map<string, YamlConfig> {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      scanDirectoryForConfigs(fullPath, configs);
    } else if (
      entry.isFile() &&
      (entry.name === "config.yaml" || entry.name.endsWith(".config.yaml"))
    ) {
      const config = yaml.load(readFileSync(fullPath, "utf8")) as YamlConfig;

      configs.set(fullPath, config);
    }
  }

  return configs;
}

// Global state to track when the Overpass API is allowed to be hit next
let nextAvailableCallTime = 0;

async function runOverpassQuery(query: string, sourceName: string): Promise<any> {
  const now = Date.now();

  // Calculate how long this specific call needs to wait in line
  const delay = Math.max(0, nextAvailableCallTime - now);

  // Reserve the next available slot for whatever call comes after this one (5000ms = 5 seconds)
  nextAvailableCallTime = Math.max(now, nextAvailableCallTime) + 5000;

  if (delay > 0) {
    console.log(
      `⏳ Rate limiting: Waiting ${(delay / 1000).toFixed(1)}s before querying ${sourceName}...`,
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  console.log(`📡 Executing Overpass Query for: ${sourceName}`);
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: query,
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });

  if (!res.ok) throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
  const osmData = await res.json();
  return osmtogeojson(osmData);
}

async function processActionableQueries(configs: Map<string, YamlConfig>) {
  const executedQueries = new Set<string>();

  for (const [file, config] of configs) {
    const currentDir = dirname(file);
    const boundaryPath = join(currentDir, "boundary.geojson");

    // Skip if already generated or manually provided
    if (existsSync(boundaryPath)) continue;

    // Run the query if it's not a delegate
    if (config.query && !config.multiple) {
      // Single Query Execution
      const geojson = await runOverpassQuery(config.query, basename(currentDir));
      writeFileSync(boundaryPath, JSON.stringify(geojson));
      console.log(`✅ Saved boundary to ${boundaryPath}`);
    } else if (config.delegateTo) {
      // Delegate Execution
      const delegatePath = resolve(currentDir, config.delegateTo);

      if (!existsSync(delegatePath)) {
        throw new Error(`Delegate target not found: ${delegatePath} (referenced by ${file})`);
      }

      // Only run the delegate if we haven't already fetched it during this process
      if (!executedQueries.has(delegatePath)) {
        const delegateConfig = yaml.load(readFileSync(delegatePath, "utf8")) as YamlConfig;
        if (!delegateConfig.query)
          throw new Error(`Delegate target missing query: ${delegatePath}`);

        const geojson = await runOverpassQuery(delegateConfig.query, delegatePath);
        const parentDir = dirname(delegatePath);

        let savedCount = 0;
        for (const feature of geojson.features) {
          if (feature.geometry.type !== "Polygon" && feature.geometry.type !== "MultiPolygon")
            continue;
          const name = feature.properties?.official_name || feature.properties?.name;
          if (!name) continue;

          const slug = slugify(name);
          const featureDir = join(parentDir, slug);

          mkdirSync(featureDir, { recursive: true });
          const outPath = join(featureDir, "boundary.geojson");

          const singleFeatureCollection = { type: "FeatureCollection", features: [feature] };
          writeFileSync(outPath, JSON.stringify(singleFeatureCollection));
          savedCount++;
        }

        console.log(`✅ Delegate ${basename(delegatePath)} generated ${savedCount} boundaries.`);
        executedQueries.add(delegatePath);
      }

      // Check if the delegate actually created the file we needed
      if (!existsSync(boundaryPath)) {
        throw new Error(
          `❌ Delegate ${config.delegateTo} was executed, but failed to generate data for ${currentDir}. Does the OSM feature exist?`,
        );
      }
    }
  }
}

/** Builds a hierarchical tree structure from the directory structure and generated boundary data. */
function buildHierarchyTree(currentPath: string, configs: Map<string, YamlConfig>): IndexNode {
  let overallBbox: BoundingBox = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };

  const entries = readdirSync(currentPath, { withFileTypes: true });

  // First check if this directory itself has a boundary
  const boundaryPath = join(currentPath, "boundary.geojson");
  if (existsSync(boundaryPath)) {
    try {
      const rawData = JSON.parse(readFileSync(boundaryPath, "utf8"));
      overallBbox = calculateGeoJsonBbox(rawData);
    } catch (e) {
      console.warn(`Warning: Failed to parse boundary for ${currentPath}.`);
    }
  }

  const self: IndexNode = { _bbox: overallBbox };

  // Recurse into children
  for (const entry of entries) {
    if (entry.name.startsWith(".") || !entry.isDirectory()) continue;

    const childNode = buildHierarchyTree(join(currentPath, entry.name), configs);
    if (childNode._bbox) {
      overallBbox = mergeBbox(overallBbox, childNode._bbox);
    }
    self[entry.name] = childNode;
  }

  // Get the _name from the config.yaml if it is in the actionableQueries map, otherwise use the directory name
  for (const [file, config] of configs) {
    if (dirname(file) === currentPath) {
      if (config.displayName) {
        self["_name"] = config.displayName;
      } else {
        self["_name"] = basename(currentPath);
      }
    }
  }

  return self;
}

function validateConfigs(configs: Map<string, YamlConfig>) {
  // Used to check if a multiple query is actually referenced by a child directory
  const declaredMultiples = new Set<string>();

  // Used to track which multiples have been referenced by child directories
  const referencedMultiples = new Set<string>();

  for (const [file, config] of configs) {
    if (config.multiple) {
      declaredMultiples.add(file);
    }
  }

  // Check for unreferenced multiples
  for (const [file, config] of configs) {
    if (config.delegateTo) {
      const delegatePath = resolve(dirname(file), config.delegateTo);
      if (declaredMultiples.has(delegatePath)) {
        referencedMultiples.add(delegatePath);
      }
    }
  }

  // Validate unreferenced multiples
  for (const declared of declaredMultiples) {
    if (!referencedMultiples.has(declared)) {
      throw new Error(
        `❌ Integrity Error: Query '${declared}' is marked as multiple: true, but no child directory delegates to it.`,
      );
    }
  }
}

async function main() {
  if (!existsSync(DATA_DIR)) {
    console.error(`Error: Data root directory "${DATA_DIR}" does not exist.`);
    process.exit(1);
  }

  console.log("=== PHASE 1: SCANNING AND RESOLVING DEPENDENCIES ===");
  const configs = scanDirectoryForConfigs(DATA_DIR);

  console.log(`Found ${configs.size} configuration files.`);

  validateConfigs(configs);

  await processActionableQueries(configs);

  console.log("\n=== PHASE 2: COMPILING HIERARCHY INDEX ===");
  const worldTree = buildHierarchyTree(DATA_DIR, configs);

  writeFileSync(OUTPUT_INDEX, JSON.stringify({ world: worldTree }));
  console.log(`🎯 Spatial Index written successfully -> ${OUTPUT_INDEX}`);
}

main().catch(console.error);
