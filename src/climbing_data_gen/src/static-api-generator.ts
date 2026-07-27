import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { writeFile } from "fs/promises";
import { join, dirname } from "path";

import { ReverseGeolocator } from "./reverse-geolocation.ts";
import type {
  Coordinates,
  DataJSON,
  GeographicFolderElement,
  OverpassElement,
  OverpassRequest,
} from "./types.ts";
import { ensureDirExists, slugify } from "../reverse-geocoding-data/src/utils.ts";

export type StaticApiGeneratorOptions = {
  outApiDirectory: string;
  osmDataFile: string;
  geoIndexFile: string;
  reverseGeocodingDataDirectory: string;
  maxCacheSize?: number;
};

export function generateStaticAPI(options: StaticApiGeneratorOptions) {
  ensureDirExists(options.outApiDirectory);

  console.info("Processing OSM Climbing Data...");
  const allElements = readOsmData(options.osmDataFile);
  const rootNodes = getRootOsmDataNodes(allElements);

  console.info("Writing static API endpoints");
  writeStaticApi(options, allElements, rootNodes);
}

function readOsmData(osmDataFile: string): Map<string, OverpassElement> {
  if (!existsSync(osmDataFile)) {
    throw new Error(`Missing OSM Data: Please ensure ${osmDataFile} exists.`);
  }

  const rawData: OverpassRequest = JSON.parse(readFileSync(osmDataFile, "utf8"));

  // Index all elements
  const osmElementsMap = new Map<string, OverpassElement>();
  for (const el of rawData.elements) {
    osmElementsMap.set(`${el.type}:${el.id}`, el);
  }

  return osmElementsMap;
}

function getRootOsmDataNodes(allElements: Map<string, OverpassElement>): OverpassElement[] {
  // Identify dependent children (so we don't geolocate a route that belongs to a crag)
  const osmParentSet = new Set<string>();
  for (const el of allElements.values()) {
    if (el.type === "way" && el.nodes) {
      el.nodes.forEach((n: number) => osmParentSet.add(`node:${n}`));
    }
    if (el.type === "relation" && el.members) {
      el.members.forEach((m) => osmParentSet.add(`${m.type}:${m.ref}`));
    }
  }

  // Process only root elements (Areas/Crags that aren't inside another relation)
  const rootElements = Array.from(allElements.values()).filter(
    (el) => !osmParentSet.has(`${el.type}:${el.id}`),
  );

  // Recursively add children to parents
  return rootElements;
}

function* iterateOverpassElementsChildren(
  element: OverpassElement,
  allElements: Map<string, OverpassElement>,
) {
  if (element.type === "way" && element.nodes) {
    for (const nodeId of element.nodes) {
      const child = allElements.get(`node:${nodeId}`);
      if (child) {
        yield child;
      }
    }
  } else if (element.type === "relation" && element.members) {
    for (const member of element.members) {
      const child = allElements.get(`${member.type}:${member.ref}`);
      if (child) {
        yield child;
      }
    }
  }
}

function* recursiveIterateOverpassElementChildren(
  el: OverpassElement,
  allElements: Map<string, OverpassElement>,
  path: OverpassElement[] = [el],
): Generator<{ path: OverpassElement[]; el: OverpassElement }> {
  yield { path, el };
  for (const child of iterateOverpassElementsChildren(el, allElements)) {
    yield* recursiveIterateOverpassElementChildren(child, allElements, [...path, child]);
  }
}

// Find a lat/lon to use for reverse geocoding
function getRepresentativeCoordinates(
  element: OverpassElement,
  allElements: Map<string, OverpassElement>,
): Coordinates | null {
  if (element.type === "node") return { lon: element.lon, lat: element.lat };
  if (element.center) return { lon: element.center.lon, lat: element.center.lat };
  // @ts-ignore
  if (element.geometry?.length > 0) {
    // @ts-ignore
    return { lon: element.geometry[0].lon, lat: element.geometry[0].lat };
  }

  // TODO: compute center
  if (element.type === "way" && element.nodes?.length > 0) {
    const child = allElements.get(`node:${element.nodes[0]}`);
    if (child) return getRepresentativeCoordinates(child, allElements);
  }
  if (element.type === "relation" && element.members?.length > 0) {
    const child = allElements.get(`${element.members[0].type}:${element.members[0].ref}`);
    if (child) return getRepresentativeCoordinates(child, allElements);
  }

  return null;
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

function getName(el: OverpassElement): string | null {
  const tags = el.tags;
  if (tags) {
    return tags.official_name || tags.name || tags["name:en"] || tags["name:fr"] || null;
  }

  return null;
}

function getPathName(el: OverpassElement): string {
  return slugify(getName(el) || `${el.type}:${el.id}`);
}

function getOsmPath(els: OverpassElement[]) {
  return els.map((el) => getPathName(el));
}

function writeDataJson(options: StaticApiGeneratorOptions, path: string, el: OverpassElement) {
  const targetPath = join(options.outApiDirectory, path, "data.json");
  ensureDirExists(dirname(targetPath));
  writeFileSync(targetPath, JSON.stringify(el));
}

function writeStaticApi(
  options: StaticApiGeneratorOptions,
  allElements: Map<string, OverpassElement>,
  rootNodes: OverpassElement[],
) {
  const geolocator = new ReverseGeolocator(
    options.geoIndexFile,
    options.reverseGeocodingDataDirectory,
    options.maxCacheSize,
  );

  // Create the geographic hierarchy
  const geographicTree: MapTree = { children: new Map() };

  let noTags = 0;
  let emptyTags = 0;
  let cliffs = 0;
  for (const rootNode of rootNodes) {
    const coordinates = getRepresentativeCoordinates(rootNode, allElements);
    if (!coordinates) {
      console.error("Failed to get representative coordinates for node", rootNode);
      continue;
    }
    const location = geolocator.geolocate(coordinates.lon, coordinates.lat);

    if (!location) {
      console.error("Failed to geolocate coordinates", coordinates, "from node", rootNode);
      continue;
    }

    addPathToMapTree(geographicTree, location);
    mkdirSync(join(options.outApiDirectory, ...location), { recursive: true });

    const visited = new Set<string>();

    for (const { el, path } of recursiveIterateOverpassElementChildren(rootNode, allElements)) {
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
        for (const child of iterateOverpassElementsChildren(el, allElements)) {
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
    }
  }
  console.info("no tags:", noTags);
  console.info("empty tags:", emptyTags);
  console.info("cliffs:", cliffs);

  // Add info to the geographicTree api endpoints by iterating through it.
  writeChildrenDataToGeoTree([options.outApiDirectory], geographicTree, geolocator);
}

function writeChildrenDataToGeoTree(
  path: string[],
  mapTree: MapTree,
  geolocator: ReverseGeolocator,
) {
  for (const [childName, childMapTree] of mapTree.children) {
    const newPath = [...path, childName];

    const data: GeographicFolderElement = {
      type: "geographic",
      name: geolocator.getName(newPath.slice(1)),
    };

    writeFile(join(newPath.join("/"), "data.json"), JSON.stringify(data satisfies DataJSON), {
      encoding: "utf-8",
    });

    writeChildrenDataToGeoTree(newPath, childMapTree, geolocator);
  }
}

/** Write the zips for a folder. Each folder contains a children zips, which contains only the data for from all children, and a deep zip, which contains all the data rest of the data.
 *
 * This means that in order to completely download an area, you need:
 *  - the area's data.json
 *  - children.zip
 *  - deep.zip
 *
 * data.json is downloaded whenever a page is loaded, along with children.zip, which is used for the sidebar.
 * deep.zip is downloaded when the user clicks "download" on an area. It is completed by children.zip. Very often, a series of requests to recursively get all children will be better, but we can also just get the whole subchildren array to simplify things.
 */
