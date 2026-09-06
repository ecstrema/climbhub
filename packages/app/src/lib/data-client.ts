import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { browser } from "$app/environment";
import type { OsmFeature } from "osm-api";
import type { DataJSONRecord } from "$lib/types";
import { resolve } from "$app/paths";
import type { AreaStats } from "$lib/types";

export interface CachedElement {
  slug: string;
  data: OsmFeature;
  modifiedAt: number;
}

export interface HierarchyManifestNode {
  modifiedAt: number;
  children?: Record<string, HierarchyManifestNode>;
}

interface ClimbDataDB extends DBSchema {
  elements: {
    key: string;
    value: CachedElement;
    indexes: { modifiedAt: number };
  };
  stats: {
    key: string;
    value: { slug: string; data: AreaStats; modifiedAt: number };
    indexes: { modifiedAt: number };
  };
}

// Only initialize IndexedDB if running in the browser
let dbPromise: Promise<IDBPDatabase<ClimbDataDB>> | null = null;
if (browser) {
  dbPromise = openDB<ClimbDataDB>("ClimbDataDB", 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const store = db.createObjectStore("elements", { keyPath: "slug" });
        store.createIndex("modifiedAt", "modifiedAt");
      }
      if (oldVersion < 2) {
        const statsStore = db.createObjectStore("stats", { keyPath: "slug" });
        statsStore.createIndex("modifiedAt", "modifiedAt");
      }
    },
  });
}

class DataClient {
  private inFlightRequests = new Map<string, Promise<any>>();

  async getNode(slug: string, customFetch: typeof fetch = globalThis.fetch): Promise<OsmFeature> {
    if (browser && dbPromise) {
      const db = await dbPromise;
      const cached = await db.get("elements", slug);
      if (cached) return cached.data;
    }

    // Deduplicate concurrent requests
    if (this.inFlightRequests.has(slug)) {
      return this.inFlightRequests.get(slug)!;
    }

    const promise = (async () => {
      const res = await customFetch(resolve("/api/world/[...slug]/data.json", { slug }));
      const data: OsmFeature = await res.json();

      if (browser && dbPromise) {
        const db = await dbPromise;
        await db.put("elements", { slug, data, modifiedAt: Date.now() });
      }

      return data;
    })();

    this.inFlightRequests.set(slug, promise);
    try {
      return await promise;
    } finally {
      this.inFlightRequests.delete(slug);
    }
  }

  async getChildren(
    slug: string,
    customFetch: typeof fetch = globalThis.fetch,
  ): Promise<DataJSONRecord> {
    const path = resolve("/api/world/[...slug]/children.json", { slug });
    const res = await customFetch(path);
    const records: DataJSONRecord = await res.json();

    if (browser && dbPromise) {
      const db = await dbPromise;
      // Use a single transaction for bulk inserts to maximize performance
      const tx = db.transaction("elements", "readwrite");
      const store = tx.objectStore("elements");

      for (const [childSlug, data] of Object.entries(records)) {
        store.put({
          slug: childSlug,
          data: data as OsmFeature,
          modifiedAt: Date.now(),
        });
      }

      await tx.done;
    }

    return records;
  }

  async getStats(
    slug: string,
    customFetch: typeof fetch = globalThis.fetch,
  ): Promise<AreaStats | undefined> {
    if (browser && dbPromise) {
      const db = await dbPromise;
      const cached = await db.get("stats", slug);
      if (cached) return cached.data;
    }

    // Prefix with 'stats-' to prevent collisions with getNode in-flight requests
    const requestKey = `stats-${slug}`;
    if (this.inFlightRequests.has(requestKey)) {
      return this.inFlightRequests.get(requestKey)!;
    }

    const promise = (async () => {
      const path = resolve("/api/world/[...slug]/stats.json", { slug });
      const res = await customFetch(path);
      if (!res.ok) return undefined;

      const data: AreaStats = await res.json();

      if (browser && dbPromise) {
        const db = await dbPromise;
        await db.put("stats", { slug, data, modifiedAt: Date.now() });
      }

      return data;
    })();

    this.inFlightRequests.set(requestKey, promise);
    try {
      return await promise;
    } finally {
      this.inFlightRequests.delete(requestKey);
    }
  }
  async reconcileWithManifest(manifest: HierarchyManifestNode) {
    if (!browser || !dbPromise) return;

    const db = await dbPromise;
    const staleSlugs: string[] = [];

    async function walk(node: HierarchyManifestNode, currentSlug: string) {
      if (currentSlug) {
        const cached = await db.get("elements", currentSlug);
        if (cached && cached.modifiedAt < node.modifiedAt) {
          staleSlugs.push(currentSlug);
        }
      }

      if (node.children) {
        for (const [childKey, childNode] of Object.entries(node.children)) {
          const childSlug = currentSlug ? `${currentSlug}/${childKey}` : childKey;
          await walk(childNode, childSlug);
        }
      }
    }

    await walk(manifest, "");

    if (staleSlugs.length > 0) {
      const tx = db.transaction("elements", "readwrite");
      const store = tx.objectStore("elements");

      for (const slug of staleSlugs) {
        store.delete(slug);
      }

      await tx.done;
    }
  }
}

export const dataClient = new DataClient();
