import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { ReverseGeolocator } from "./reverse-geolocation";
import { zipSync } from "fflate";

// --- CONFIGURATION ---
const REVERSE_GEOCODING_DATA_DIR = join(dirname(__filename), "../reverse-geocoding-data/data");
const OSM_DATA_FILE = join(dirname(__filename), "climbing-data.json");
const GEO_INDEX_FILE = join(REVERSE_GEOCODING_DATA_DIR, "hierarchy-index.json");
const GEO_WORLD_DIR = join(REVERSE_GEOCODING_DATA_DIR, "world");

const OUT_API_DIR = join(dirname(__filename), "../../../static/api");

// --- INTERFACES ---
interface VirtualNode {
  id: string; // The slugified folder/element name
  path: string; // URL-safe relative path (e.g., 'canada/quebec/val-david')
  name: string; // Display name
  type: string; // 'folder' (geographic), 'node', 'way', 'relation'
  hasChildren: boolean;
  children: Map<string, VirtualNode>;
  elementData: any; // The full JSON payload for SvelteKit
}

// --- UTILS ---
function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

// Ensure base output directory exists
ensureDir(OUT_API_DIR);

// --- MAIN GENERATOR CLASS ---
export class StaticApiGenerator {
  private geolocator: ReverseGeolocator;
  private virtualTree: VirtualNode;
  private osmElementsMap = new Map<string, any>();
  private osmParentSet = new Set<string>();
  private textEncoder = new TextEncoder();

  constructor() {
    // Index roots include "world", so base dir must be the parent of the world folder.
    this.geolocator = new ReverseGeolocator(GEO_INDEX_FILE, REVERSE_GEOCODING_DATA_DIR, 100);
    this.virtualTree = {
      id: "world",
      path: "world",
      name: "World",
      type: "folder",
      hasChildren: true,
      children: new Map(),
      elementData: { slug: "world", path: "world", name: "World", type: "folder" },
    };
  }

  public async run() {
    console.log("🌍 Initializing geographic base tree...");
    this.buildGeographicTree(GEO_WORLD_DIR, this.virtualTree);

    console.log("🧗 Processing OSM Climbing Data...");
    this.processOsmData();

    console.log("🧹 Pruning empty geographic regions...");
    this.pruneEmptyFolders(this.virtualTree);

    console.log("🏗️  Writing static API endpoints for SvelteKit...");
    this.writeStaticApi(this.virtualTree);

    console.log("📦 Generating offline regional ZIP bundles...");
    this.generateZips(this.virtualTree);

    console.log(`✅ Success! Static API generated in ${OUT_API_DIR}`);
  }

  // 1. Pre-build the geographic folder structure (Canada -> Quebec -> etc.)
  private buildGeographicTree(currentDir: string, parentNode: VirtualNode) {
    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        const fullPath = join(currentDir, entry.name);
        const relPath = parentNode.path ? `${parentNode.path}/${entry.name}` : entry.name;

        let prettyName = entry.name;

        // Attempt to extract official name from geojson if it exists
        const boundaryPath = join(fullPath, "boundary.geojson");
        if (existsSync(boundaryPath)) {
          try {
            const geojson = JSON.parse(readFileSync(boundaryPath, "utf8"));
            const feature = geojson.features?.[0] || geojson;
            prettyName = feature.properties?.name || prettyName;
          } catch (e) {
            console.warn(`⚠️  Failed to parse boundary.geojson for ${relPath}: ${e}`);
          }
        }

        const node: VirtualNode = {
          id: entry.name,
          path: relPath,
          name: prettyName,
          type: "folder",
          hasChildren: false, // Will be updated later
          children: new Map(),
          elementData: { slug: entry.name, path: relPath, name: prettyName, type: "folder" },
        };

        parentNode.children.set(node.id, node);
        this.buildGeographicTree(fullPath, node);
      }
    }
  }

  // 2. Parse flat OSM data, find hierarchies, and geolocate top-level features
  private processOsmData() {
    if (!existsSync(OSM_DATA_FILE)) {
      throw new Error(`Missing OSM Data: Please ensure ${OSM_DATA_FILE} exists.`);
    }

    const rawData = JSON.parse(readFileSync(OSM_DATA_FILE, "utf8"));

    // Index all elements
    for (const el of rawData.elements) {
      this.osmElementsMap.set(`${el.type}:${el.id}`, el);
    }

    // Identify dependent children (so we don't geolocate a route that belongs to a crag)
    for (const el of rawData.elements) {
      if (el.type === "way" && el.nodes) {
        el.nodes.forEach((n: number) => this.osmParentSet.add(`node:${n}`));
      }
      if (el.type === "relation" && el.members) {
        el.members.forEach((m: any) => this.osmParentSet.add(`${m.type}:${m.ref}`));
      }
    }

    // Process only root elements (Areas/Crags that aren't inside another relation)
    const rootElements = rawData.elements.filter(
      (el: any) => !this.osmParentSet.has(`${el.type}:${el.id}`),
    );
    let geolocatedCount = 0;

    for (const rootEl of rootElements) {
      // Only process features that are actually tagged (ignore raw untagged boundary geometry)
      if (!rootEl.tags || Object.keys(rootEl.tags).length === 0) continue;

      const coords = this.getRepresentativeCoordinates(rootEl);
      if (!coords) {
        console.warn(`Could not find coordinates for ${rootEl.type} ${rootEl.id}`);
        continue;
      }

      const geoPath = this.geolocator.geolocate(coords[0], coords[1]);
      if (geoPath) {
        // Strip the base data dir from the returned path to match our virtual tree
        const relativeGeoPath = geoPath
          .replace(GEO_WORLD_DIR, "")
          .replace(/^[/\\]/, "")
          .replace(/\\/g, "/");

        // Find the geographic node to attach this to
        let targetNode = this.virtualTree;
        if (relativeGeoPath) {
          const parts = relativeGeoPath.split("/");
          for (const part of parts) {
            if (targetNode.children.has(part)) {
              targetNode = targetNode.children.get(part)!;
            }
          }
        }

        // Build the hierarchical OSM branch and attach it
        const osmBranch = this.buildOsmTreeBranch(rootEl, targetNode.path);
        targetNode.children.set(osmBranch.id, osmBranch);
        geolocatedCount++;
      }
    }

    console.log(`📍 Successfully geolocated and mapped ${geolocatedCount} root climbing areas.`);
  }

  // 3. Recursively build the OSM element tree (Relation -> Way -> Node)
  private buildOsmTreeBranch(element: any, parentPath: string): VirtualNode {
    const name = element.tags?.name || `Unnamed ${element.type}`;
    // Attach ID to slug to prevent URL collisions of "unnamed-way"
    const slug = `${slugify(name)}-${element.id}`;
    const currentPath = parentPath ? `${parentPath}/${slug}` : slug;

    const node: VirtualNode = {
      id: slug,
      path: currentPath,
      name: name,
      type: element.type,
      hasChildren: false,
      children: new Map(),
      elementData: { ...element, path: currentPath, slug: slug },
    };

    // Recursively resolve children (Ways -> Nodes, Relations -> Members)
    if (element.type === "way" && element.nodes) {
      for (const nodeId of element.nodes) {
        const child = this.osmElementsMap.get(`node:${nodeId}`);
        // Only add children to the navigation tree if they have tags (e.g. named routes/boulders).
        // Untagged nodes are just geometry points drawing the crag line.
        if (child && child.tags) {
          const childNode = this.buildOsmTreeBranch(child, currentPath);
          node.children.set(childNode.id, childNode);
        }
      }
    } else if (element.type === "relation" && element.members) {
      for (const member of element.members) {
        const child = this.osmElementsMap.get(`${member.type}:${member.ref}`);
        if (child && child.tags) {
          const childNode = this.buildOsmTreeBranch(child, currentPath);
          node.children.set(childNode.id, childNode);
        }
      }
    }

    node.hasChildren = node.children.size > 0;
    return node;
  }

  // Find a lat/lon to use for reverse geocoding
  private getRepresentativeCoordinates(element: any): [number, number] | null {
    if (element.lat !== undefined && element.lon !== undefined) return [element.lon, element.lat];
    if (element.center) return [element.center.lon, element.center.lat];
    if (element.geometry?.length > 0) return [element.geometry[0].lon, element.geometry[0].lat];

    // Fallback: look up the first member node
    if (element.type === "way" && element.nodes?.length > 0) {
      const child = this.osmElementsMap.get(`node:${element.nodes[0]}`);
      if (child) return this.getRepresentativeCoordinates(child);
    }
    if (element.type === "relation" && element.members?.length > 0) {
      const child = this.osmElementsMap.get(`${element.members[0].type}:${element.members[0].ref}`);
      if (child) return this.getRepresentativeCoordinates(child);
    }

    return null;
  }

  // 4. Remove geographic regions (like specific cities) that contain zero climbing data
  private pruneEmptyFolders(node: VirtualNode): boolean {
    if (node.type !== "folder") return true; // Keep all OSM data

    let hasValuableContent = false;
    for (const [key, childNode] of node.children.entries()) {
      const keep = this.pruneEmptyFolders(childNode);
      if (!keep) {
        node.children.delete(key);
      } else {
        hasValuableContent = true;
      }
    }

    node.hasChildren = node.children.size > 0;
    return hasValuableContent;
  }

  // 5. Walk the finalized tree and write the files SvelteKit expects into a unified directory structure
  private writeStaticApi(node: VirtualNode) {
    const shallowChildrenArray = Array.from(node.children.values()).map((child) => ({
      id: child.id,
      path: child.path,
      name: child.name,
      type: child.type,
      hasChildren: child.hasChildren,
    }));

    const dirPath = node.path || "world";
    const targetDir = join(OUT_API_DIR, dirPath);
    ensureDir(targetDir);

    // 1. Write Sidebar Tree payload
    writeFileSync(join(targetDir, "tree.json"), JSON.stringify(shallowChildrenArray, null, 2));

    // 2. Write Element Page payload
    writeFileSync(join(targetDir, "elements.json"), JSON.stringify(node.elementData, null, 2));

    // 3. Recurse
    for (const childNode of node.children.values()) {
      this.writeStaticApi(childNode);
    }
  }

  // 6. Recursively build ZIP bundles for offline PWA
  private generateZips(node: VirtualNode) {
    // Only generate zip bundles for geographic regions, not individual climbing routes
    if (node.type === "folder") {
      const files: Record<string, Uint8Array> = {};

      // Collect every JSON file for this region and its sub-regions
      this.collectSubtreeFiles(node, files);

      // Compress them into a single zip buffer using fflate
      const zipBuffer = zipSync(files);

      const dirPath = node.path || "world";
      const targetDir = join(OUT_API_DIR, dirPath);
      ensureDir(targetDir);

      writeFileSync(join(targetDir, "download.zip"), zipBuffer);
    }

    // Recurse to generate nested regional zips
    for (const childNode of node.children.values()) {
      this.generateZips(childNode);
    }
  }

  // Helper method to gather all files in a subtree for compression
  private collectSubtreeFiles(node: VirtualNode, files: Record<string, Uint8Array>) {
    const shallowChildrenArray = Array.from(node.children.values()).map((child) => ({
      id: child.id,
      path: child.path,
      name: child.name,
      type: child.type,
      hasChildren: child.hasChildren,
    }));

    const dirPath = node.path || "world";

    // Set paths explicitly for the unified format: api/region/tree.json
    files[`api/${dirPath}/tree.json`] = this.textEncoder.encode(
      JSON.stringify(shallowChildrenArray, null, 2),
    );

    files[`api/${dirPath}/elements.json`] = this.textEncoder.encode(
      JSON.stringify(node.elementData, null, 2),
    );

    // Recurse to add all descendant files
    for (const childNode of node.children.values()) {
      this.collectSubtreeFiles(childNode, files);
    }
  }
}
