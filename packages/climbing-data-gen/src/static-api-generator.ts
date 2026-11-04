import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";

import { ReverseGeolocator } from "./reverse-geolocation.ts";
import type { Coordinates, DataJSON, GeographicFolderElement, OverpassRequest } from "./types.ts";
import { ensureDirExists, slugify } from "@climbhub/reverse-geocoding-data";
import type { OsmFeature } from "osm-api";
import { getStaticIdentifier, osmIndexFile, osmPathSegment } from "@climbhub/common";

export type StaticApiGeneratorOptions = {
  outApiDirectory: string;
  /** Overpass responses, for instance one per tile. An element may be in several of them. */
  osmDataFiles: string[];
  geoIndexFile: string;
  reverseGeocodingDataDirectory: string;
  maxCacheSize?: number;
};

export function generateStaticAPI(options: StaticApiGeneratorOptions) {
  ensureDirExists(options.outApiDirectory);

  console.info("Processing OSM Climbing Data...");
  const allElements = readOsmData(options.osmDataFiles);
  const rootNodes = getRootOsmDataNodes(allElements);

  console.info("Writing static API endpoints");
  writeStaticApi(options, allElements, rootNodes);
}

function readOsmData(osmDataFiles: string[]): Map<string, OsmFeature> {
  // Index all elements
  const osmElementsMap = new Map<string, OsmFeature>();
  for (const osmDataFile of osmDataFiles) {
    if (!existsSync(osmDataFile)) {
      throw new Error(`Missing OSM Data: Please ensure ${osmDataFile} exists.`);
    }

    const rawData: OverpassRequest = JSON.parse(readFileSync(osmDataFile, "utf8"));
    for (const el of rawData.elements) {
      const id = getStaticIdentifier(el.type, el.id);
      // The files may have been downloaded at different times: keep the latest version
      const existing = osmElementsMap.get(id);
      if (existing && (existing.version ?? 0) >= (el.version ?? 0)) continue;
      osmElementsMap.set(id, el);
    }
  }
  console.info(`${osmElementsMap.size} elements in ${osmDataFiles.length} files`);

  return osmElementsMap;
}

function getRootOsmDataNodes(allElements: Map<string, OsmFeature>): OsmFeature[] {
  // Identify dependent children (so we don't geolocate a route that belongs to a crag)
  const osmParentSet = new Set<string>();
  for (const el of allElements.values()) {
    if (el.type === "way" && el.nodes) {
      el.nodes.forEach((n: number) => osmParentSet.add(getStaticIdentifier("node", n)));
    }
    if (el.type === "relation" && el.members) {
      el.members.forEach((m) => osmParentSet.add(getStaticIdentifier(m.type, m.ref)));
    }
  }

  // Process only root elements (Areas/Crags that aren't inside another relation)
  const rootElements = Array.from(allElements.values()).filter(
    (el) => !osmParentSet.has(getStaticIdentifier(el.type, el.id)),
  );

  // Recursively add children to parents
  return rootElements;
}

function* iterateOsmFeaturesChildren(element: OsmFeature, allElements: Map<string, OsmFeature>) {
  if (element.type === "way" && element.nodes) {
    for (const nodeId of element.nodes) {
      const child = allElements.get(getStaticIdentifier("node", nodeId));
      if (child) {
        yield child;
      }
    }
  } else if (element.type === "relation" && element.members) {
    for (const member of element.members) {
      const child = allElements.get(getStaticIdentifier(member.type, member.ref));
      if (child) {
        yield child;
      }
    }
  }
}

function* recursiveIterateOsmFeatureChildren(
  el: OsmFeature,
  allElements: Map<string, OsmFeature>,
  path: OsmFeature[] = [el],
): Generator<{ path: OsmFeature[]; el: OsmFeature }> {
  yield { path, el };
  for (const child of iterateOsmFeaturesChildren(el, allElements)) {
    yield* recursiveIterateOsmFeatureChildren(child, allElements, [...path, child]);
  }
}

// Find a lat/lon to use for reverse geocoding
function getRepresentativeCoordinates(
  element: OsmFeature,
  allElements: Map<string, OsmFeature>,
): Coordinates | undefined {
  if (element.type === "node") return { lon: element.lon, lat: element.lat };
  // @ts-ignore
  if (element.center) return { lon: element.center.lon, lat: element.center.lat };
  // @ts-ignore
  if (element.geometry?.length > 0) {
    // @ts-ignore
    return { lon: element.geometry[0].lon, lat: element.geometry[0].lat };
  }

  // TODO: compute center
  if (element.type === "way" && element.nodes?.length > 0) {
    const child = allElements.get(getStaticIdentifier("node", element.nodes[0]!));
    if (child) return getRepresentativeCoordinates(child, allElements);
  }
  if (element.type === "relation" && element.members?.length > 0) {
    if (!element.members[0]) return;
    const child = allElements.get(getStaticIdentifier(element.members[0].type, element.members[0].ref));
    if (child) return getRepresentativeCoordinates(child, allElements);
  }
}

interface MapTree {
  children: Map<string, MapTree>;
}

function addPathToMapTree(mapTree: MapTree, path: string[], index = 0) {
  if (!path[index] || !mapTree) {
    return;
  }
  addPathToMapTree(
    mapTree.children.getOrInsertComputed(path[index], () => ({ children: new Map() })),
    path,
    index + 1,
  );
}

function getName(el: OsmFeature): string | undefined {
  const tags = el.tags;
  if (tags) {
    return tags.official_name || tags.name || tags["name:en"] || tags["name:fr"];
  }
}

function getPathName(el: OsmFeature): string {
  const name = getName(el);
  return osmPathSegment(name && slugify(name), el.type, el.id);
}

function getOsmPath(els: OsmFeature[]) {
  return els.map((el) => getPathName(el));
}

function writeDataJson(options: StaticApiGeneratorOptions, path: string, el: OsmFeature) {
  const targetPath = join(options.outApiDirectory, path, "data.json");
  ensureDirExists(dirname(targetPath));
  writeFileSync(targetPath, JSON.stringify(el));
}

function writeStaticApi(
  options: StaticApiGeneratorOptions,
  allElements: Map<string, OsmFeature>,
  rootNodes: OsmFeature[],
) {
  const geolocator = new ReverseGeolocator(
    options.geoIndexFile,
    options.reverseGeocodingDataDirectory,
    options.maxCacheSize,
  );

  // Create the geographic hierarchy
  const geographicTree: MapTree = { children: new Map() };

  // Current slug of every OSM feature, by index file
  const osmIndex = new Map<string, Record<string, string>>();
  let noTags = 0;
  let emptyTags = 0;
  let cliffs = 0;
  const outsideRegions: string[] = [];
  for (const rootNode of rootNodes) {
    const coordinates = getRepresentativeCoordinates(rootNode, allElements);
    if (!coordinates) {
      console.error("Failed to get representative coordinates for node", rootNode);
      continue;
    }
    const location = geolocator.geolocate(coordinates.lon, coordinates.lat);

    // Outside of every region of @climbhub/reverse-geocoding-data: not in the API until a region
    // is added there
    if (!location) {
      outsideRegions.push(`${rootNode.type}/${rootNode.id} (${coordinates.lon},${coordinates.lat})`);
      continue;
    }

    addPathToMapTree(geographicTree, location);
    mkdirSync(join(options.outApiDirectory, ...location), { recursive: true });

    const visited = new Set<string>();

    for (const { el, path } of recursiveIterateOsmFeatureChildren(rootNode, allElements)) {
      if (!el.tags) {
        noTags++;
        continue;
      }
      if (el.tags && Object.keys(el.tags).length === 0) {
        emptyTags++;
        continue;
      }
      // Sectors sometimes include the contour of their cliffs
      if (el.type === "way" && el.tags?.natural === "cliff") {
        cliffs++;
        let hasChildrenWithTags = false;
        for (const child of iterateOsmFeaturesChildren(el, allElements)) {
          if (child.tags) {
            hasChildrenWithTags = true;
            break;
          }
        }
        if (!hasChildrenWithTags) {
          continue;
        }
      }

      const completePath = [...location, ...getOsmPath(path)];
      let pathString = completePath.join("/");
      let duplicate = visited.has(pathString);
      if (duplicate) {
        console.warn(
          "Duplicate path:",
          pathString,
          "For routes or projects, disambiguate the name (e.g. 'Project 1'. If this shows up for a route with the same name as its sector, don't forget to set the sector as a relation and add this route to the relation.",
        );
      }
      visited.add(pathString);

      writeDataJson(options, pathString, el);
      const indexFile = osmIndexFile(el.type, el.id);
      const bucket = osmIndex.get(indexFile) ?? {};
      bucket[el.id] = pathString.slice("world/".length);
      osmIndex.set(indexFile, bucket);
    }
  }
  console.info("no tags:", noTags);
  console.info("empty tags:", emptyTags);
  console.info("cliffs:", cliffs);
  if (outsideRegions.length > 0) {
    console.warn(
      `${outsideRegions.length} root elements are outside of every region, and skipped:`,
      outsideRegions.slice(0, 20).join(", ") + (outsideRegions.length > 20 ? ", ..." : ""),
    );
  }

  for (const [file, bucket] of osmIndex) {
    const target = join(options.outApiDirectory, file);
    ensureDirExists(dirname(target));
    writeFileSync(target, JSON.stringify(bucket));
  }

  // Add info to the geographicTree api endpoints by iterating through it.
  writeChildrenDataToGeoTree([options.outApiDirectory], geographicTree, geolocator);

  console.info("Writing static child, download, and stats endpoints");
  writeStaticApiMetadata(join(options.outApiDirectory, "world"));
}

function writeChildrenDataToGeoTree(path: string[], mapTree: MapTree, geolocator: ReverseGeolocator) {
  for (const [childName, childMapTree] of mapTree.children) {
    const newPath = [...path, childName];

    const { id, name } = geolocator.getName(newPath.slice(1));
    const data: GeographicFolderElement = {
      type: "geographic",
      name,
      nameId: id,
      bbox: geolocator.getBBox(newPath.slice(1)),
    };

    writeFileSync(join(newPath.join("/"), "data.json"), JSON.stringify(data satisfies DataJSON));

    writeChildrenDataToGeoTree(newPath, childMapTree, geolocator);
  }
}

type DataJSONRecord = Record<string, DataJSON>;

interface GeneratedDirectory {
  data?: DataJSON;
  totalRoutes: number;
}

const routeClimbingValues = new Set([
  "route_bottom",
  "route_top",
  "route",
  "route_start",
  "boulder",
  "bouldering",
  "abseil_route",
  "abseil",
  "toprope",
  "drytooling",
]);

function isRoute(data: DataJSON | undefined): boolean {
  if (!data || data.type === "geographic" || !data.tags?.climbing) return false;
  return data.tags.climbing.split(";").some((value) => routeClimbingValues.has(value.trim()));
}

function writeStaticApiMetadata(worldDirectory: string) {
  /** Every node of the world, written once at the root for the app to download */
  const download: DataJSONRecord = {};

  function visit(directory: string, slug: string): GeneratedDirectory {
    const dataPath = join(directory, "data.json");
    const data = existsSync(dataPath) ? (JSON.parse(readFileSync(dataPath, "utf8")) as DataJSON) : undefined;
    const childDirectories = readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    const children: DataJSONRecord = {};
    const childResults: { slug: string; directory: string; result: GeneratedDirectory }[] = [];
    let totalRoutes = 0;

    for (const entry of childDirectories) {
      const childSlug = slug ? `${slug}/${entry.name}` : entry.name;
      const childDirectory = join(directory, entry.name);
      const result = visit(childDirectory, childSlug);
      childResults.push({ slug: childSlug, directory: childDirectory, result });

      if (!result.data) continue;
      children[childSlug] = result.data;
      download[childSlug] = result.data;
      totalRoutes += isRoute(result.data) ? 1 : result.totalRoutes;
    }

    writeFileSync(join(directory, "children.json"), JSON.stringify(children));
    writeFileSync(join(directory, "stats.json"), JSON.stringify({ totalRoutes }));

    return { data, totalRoutes };
  }

  visit(worldDirectory, "");
  const downloadJson = JSON.stringify(download);
  writeFileSync(join(worldDirectory, "download.json"), downloadJson);
  writeFileSync(
    join(worldDirectory, "data-version.json"),
    JSON.stringify({ version: createHash("sha256").update(downloadJson).digest("hex") }),
  );
}
