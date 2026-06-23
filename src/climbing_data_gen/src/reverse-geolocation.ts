import { existsSync, readFileSync } from "fs";
import { join } from "path";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import type { Feature, Point, GeoJsonProperties } from "geojson";

interface BoundingBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

interface IndexNode {
  bbox: BoundingBox | null;
  [key: string]: any; // Children directories
}

export class ReverseGeolocator {
  private indexTree: { [key: string]: IndexNode };
  private dataDir: string;

  // LRU Cache: Maps filepath -> Array of parsed Turf Polygon features
  private geoJsonCache: Map<string, any[]>;
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
  public geolocate(lon: number, lat: number): string | null {
    const targetPoint = point([lon, lat]);

    // Start the recursive search from the root objects (e.g., "world")
    for (const [rootName, rootNode] of Object.entries(this.indexTree)) {
      // Support both layouts:
      // 1) dataDir is parent directory containing the root key folder (e.g. .../data + world)
      // 2) dataDir already points at the root key folder (e.g. .../data/world)
      const candidatePath = join(this.dataDir, rootName);
      const rootPath = existsSync(candidatePath) ? candidatePath : this.dataDir;
      const matchedPath = this.searchHierarchy(rootNode, rootPath, targetPoint);

      if (matchedPath) {
        return matchedPath;
      }
    }

    return null;
  }

  private searchHierarchy(
    node: IndexNode,
    currentPath: string,
    targetPoint: Feature<Point, GeoJsonProperties>,
  ): string | null {
    // 1. BOUNDING BOX CHECK (Fast Pre-filter)
    if (node.bbox) {
      const [lon, lat] = targetPoint.geometry.coordinates;
      const { x0, x1, y0, y1 } = node.bbox;

      if (lon < x0 || lon > x1 || lat < y0 || lat > y1) {
        // Point is completely outside this directory's bounding box. Stop searching this branch.
        return null;
      }
    } else {
      // If a node lacks a bbox entirely, we cannot safely assume anything about its bounds.
      return null;
    }

    // 2. CHECK CHILDREN (Attempt to find the deepest/most granular match)
    for (const [key, val] of Object.entries(node)) {
      if (key === "bbox") continue;

      const childPath = join(currentPath, key);
      const matched = this.searchHierarchy(val as IndexNode, childPath, targetPoint);

      if (matched) {
        return matched; // Found a granular match deep in the tree!
      }
    }

    // 3. PRECISE POLYGON CHECK (Fallback)
    const geojsonPath = join(currentPath, "boundary.geojson");

    if (existsSync(geojsonPath)) {
      if (this.checkPolygonContains(geojsonPath, targetPoint)) {
        return currentPath;
      }
    }

    return null;
  }

  private checkPolygonContains(
    filepath: string,
    targetPoint: Feature<Point, GeoJsonProperties>,
  ): boolean {
    try {
      const features = this.getCachedFeatures(filepath);

      for (const feature of features) {
        if (booleanPointInPolygon(targetPoint, feature)) {
          return true;
        }
      }
    } catch (err) {
      console.error(`Error processing polygon for ${filepath}:`, err);
    }

    return false;
  }

  /**
   * Retrieves GeoJSON features from memory, or loads them from disk if missing.
   * Manages memory using a Least Recently Used (LRU) eviction strategy.
   */
  private getCachedFeatures(filepath: string): any[] {
    if (this.geoJsonCache.has(filepath)) {
      // Cache Hit: Move this item to the end of the Map to mark it as most recently used
      const features = this.geoJsonCache.get(filepath)!;
      this.geoJsonCache.delete(filepath);
      this.geoJsonCache.set(filepath, features);
      return features;
    }

    // Cache Miss: Load and parse from disk
    const rawData = readFileSync(filepath, "utf8");
    const geojson = JSON.parse(rawData);

    // Normalize into an array of features
    const allFeatures =
      geojson.type === "FeatureCollection"
        ? geojson.features
        : geojson.type === "Feature"
          ? [geojson]
          : [{ type: "Feature", geometry: geojson }];

    // Optimization: Filter out points/lines to only cache the polygons we actually need
    const polygonFeatures = allFeatures.filter((f: any) => {
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
