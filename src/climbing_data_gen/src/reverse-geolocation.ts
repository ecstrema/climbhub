import { existsSync, readFileSync } from "fs";
import { join } from "path";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type { Position, Feature, MultiPolygon, Polygon } from "geojson";
import type { IndexNode } from "../reverse-geocoding-data/src/types.ts";

export class ReverseGeolocator {
  /** The tree with the bounding boxes and the children. */
  private indexTree: IndexNode;

  /** Base directory where the world data is stored */
  private dataDir: string;

  /**
   * LRU Cache: Maps filepath -> Array of parsed Turf Polygon features
   * TODO: add types for the features.
   */
  private geoJsonCache: Map<string, Feature<MultiPolygon | Polygon>[]>;
  private maxCacheSize: number;

  /**
   * Initializes the reverse geolocator, keeping the index loaded in memory.
   * @param indexPath Path to the hierarchy-index.json file
   * @param dataDir Base directory where the world data is stored
   * @param maxCacheSize Maximum number of boundary.geojson files to keep in memory (default: 100)
   */
  constructor(indexPath: string, dataDir: string, maxCacheSize: number = 100) {
    if (!existsSync(indexPath)) {
      throw new Error(`Index file not found: ${indexPath}`);
    }

    const indexData = readFileSync(indexPath, "utf8");
    this.indexTree = JSON.parse(indexData);
    this.dataDir = dataDir;

    this.geoJsonCache = new Map();
    this.maxCacheSize = maxCacheSize;
  }

  /**
   * Finds the deepest matching directory for a given coordinate.
   */
  public geolocate(lon: number, lat: number): string[] | null {
    return this.geolocateRecursive(lon, lat, ["world"]);
  }

  private geolocateRecursive(
    lon: number,
    lat: number,
    path: string[],
    node?: IndexNode,
  ): string[] | null {
    const indexNode = node || this.getIndexNodeForPath(path);
    if (!indexNode) {
      console.error(`Index node not found for path: ${path.join("/")}`);
      return null;
    }

    // Do a fast prefilter using bounding boxes
    if (indexNode._bbox) {
      const { x0, x1, y0, y1 } = indexNode._bbox;
      if (lon < x0 || lon > x1 || lat < y0 || lat > y1) {
        // Point is outside the bounding box of this node
        return null;
      }
    }

    // If we are inside the bounding box, check children recursively
    for (const [key, val] of Object.entries(indexNode)) {
      if (key === "_bbox" || key === "_name") continue;

      const matched = this.geolocateRecursive(lon, lat, [...path, key], val as IndexNode);

      if (matched) {
        return matched;
      }
    }

    // If no children matched, check if this node has a precise polygon
    if (this.checkPolygonContains(path, [lon, lat])) {
      return path;
    }

    // If we reach here, it means the point is inside the bounding box but not in the child itself. False positive.
    return null;
  }

  private getIndexNodeForPath(path: string[]): IndexNode | null {
    let currentNode: IndexNode | null = this.indexTree;

    for (const segment of path) {
      if (!currentNode || !currentNode[segment]) {
        return null;
      }
      currentNode = currentNode[segment] as IndexNode;
    }

    return currentNode;
  }

  private checkPolygonContains(path: string[], targetPoint: Position): boolean {
    try {
      const features = this.getCachedFeatures(path);

      for (const feature of features) {
        if (booleanPointInPolygon(targetPoint, feature)) {
          return true;
        }
      }
    } catch (err) {
      console.error(`Error processing polygon for ${join(...path)}:`, err);
    }

    return false;
  }

  // Get the name of a path, as given by the geojson properties.
  public getName(path: string[]) {
    // Check if the hierarchy-index.json has a name for this path
    let currentNode: IndexNode | null = this.indexTree;
    for (const segment of path) {
      if (!currentNode || !currentNode[segment]) {
        currentNode = null;
        break;
      }
      currentNode = currentNode[segment] as IndexNode;
    }

    if (currentNode && currentNode._name) {
      return currentNode._name;
    }

    const features = this.getCachedFeatures(path);

    const properties = features[0]?.properties;
    // TODO: handle translations
    return properties?.official_name || properties?.name;
  }

  /**
   * Retrieves GeoJSON features from memory, or loads them from disk if missing.
   * Manages memory using a Least Recently Used (LRU) eviction strategy.
   */
  private getCachedFeatures(path: string[]): Feature<MultiPolygon | Polygon>[] {
    const fullFilePath = join(this.dataDir, ...path, "boundary.geojson");

    const filepath = join(...path, "boundary.geojson");
    if (this.geoJsonCache.has(filepath)) {
      // Cache Hit: Move this item to the end of the Map to mark it as most recently used
      const features = this.geoJsonCache.get(filepath)!;
      this.geoJsonCache.delete(filepath);
      this.geoJsonCache.set(filepath, features);
      return features;
    }

    // Cache Miss: Load and parse from disk

    if (!existsSync(fullFilePath)) {
      throw new Error(`GeoJSON file not found: ${fullFilePath}`);
    }

    const rawData = readFileSync(fullFilePath, "utf8");
    const geojson = JSON.parse(rawData);

    // Normalize into an array of features
    const allFeatures =
      geojson.type === "FeatureCollection"
        ? geojson.features
        : geojson.type === "Feature"
          ? [geojson]
          : [{ type: "Feature", geometry: geojson }];

    // Optimization: Filter out points/lines to only cache the polygons we actually need
    const polygonFeatures = allFeatures.filter((f: Feature) => {
      const geomType = f.geometry?.type;
      return geomType === "Polygon" || geomType === "MultiPolygon";
    });

    // Enforce cache limit: delete the oldest item (first item in the Map iterator)
    if (this.geoJsonCache.size >= this.maxCacheSize) {
      const oldestKey = this.geoJsonCache.keys().next().value;
      if (oldestKey) {
        this.geoJsonCache.delete(oldestKey);
      }
    }

    // Store in cache and return
    this.geoJsonCache.set(filepath, polygonFeatures);
    return polygonFeatures;
  }
}
