import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { browser } from "$app/env";
import type { OsmFeature } from "osm-api";
import type { DataJSONRecord } from "$lib/types";
import { resolve } from "$app/paths";
import type { AreaStats } from "$lib/types";

export interface CachedElement {
  slug: string;
  data: OsmFeature;
  /** Indicates when the children were last fetched */
  childrenFetchedAt?: number;
  modifiedAt: number;
}

export interface CachedStats {
  slug: string;
  data: AreaStats;
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
    value: CachedStats;
    indexes: { modifiedAt: number };
  };
}

// Only initialize IndexedDB if running in the browser
let dbPromise: Promise<IDBPDatabase<ClimbDataDB>> | null = null;
if (browser) {
  dbPromise = openDB<ClimbDataDB>("ClimbDataDB", 1, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const store = db.createObjectStore("elements", { keyPath: "slug" });
        store.createIndex("modifiedAt", "modifiedAt");
        const statsStore = db.createObjectStore("stats", { keyPath: "slug" });
        statsStore.createIndex("modifiedAt", "modifiedAt");
      }
    },
  });
}

class DataClient {
  private inFlightRequests = new Map<string, Promise<any>>();

  async getNode(slug: string, customFetch: typeof fetch = globalThis.fetch): Promise<OsmFeature> {
    const requestKey = `node-${slug}`;
    if (this.inFlightRequests.has(requestKey)) {
      return this.inFlightRequests.get(requestKey)!;
    }

    if (browser && dbPromise) {
      const db = await dbPromise;
      const cached = await db.get("elements", slug);
      if (cached) return cached.data;
    }

    const promise = (async () => {
      const res = await customFetch(resolve("/api/world/[...slug]/data.json", { slug }));

      if (!res.ok) {
        console.error(`Failed to fetch data for ${slug}`);
        return {
          type: "node",
          id: 0,
          changeset: 0,
          timestamp: "",
          version: 0,
          user: "",
          uid: 0,
          lat: 0,
          lon: 0,
        } satisfies OsmFeature;
      }

      const data: OsmFeature = await res.json();

      if (browser && dbPromise) {
        const db = await dbPromise;
        await db.put("elements", { slug, data, modifiedAt: Date.now() });
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

  async getChildren(
    slug: string,
    customFetch: typeof fetch = globalThis.fetch,
  ): Promise<DataJSONRecord> {
    const requestKey = `children-${slug}`;
    if (this.inFlightRequests.has(requestKey)) {
      return this.inFlightRequests.get(requestKey)!;
    }

    // Check if the children are already cached and up-to-date
    if (browser && dbPromise) {
      const db = await dbPromise;
      const cached = await db.get("elements", slug);
      if (cached && cached.childrenFetchedAt) {
        return this.getCachedChildren(slug, db);
      }
    }

    const promise = this.fetchAndCacheChildren(slug, customFetch);

    this.inFlightRequests.set(requestKey, promise);
    try {
      return await promise;
    } finally {
      this.inFlightRequests.delete(requestKey);
    }
  }

  private async getCachedChildren(slug: string, db: IDBPDatabase<ClimbDataDB>): Promise<DataJSONRecord> {
    const tx = db.transaction("elements", "readonly");
    const store = tx.objectStore("elements");
    const children: DataJSONRecord = {};

    const prefix = `${slug}/`;
    // Create a boundary capturing everything starting with the prefix, this avoids the O(n) search, and uses the B-tree to get O(logN + K) (jumping to the first matching key and then iterating over the next K matching keys)
    // The "\uffff" character is the last character in the Unicode range, so this effectively captures all keys that start with the prefix.
    const range = IDBKeyRange.bound(prefix, prefix + "\uffff");

    // The cursor will now only iterate over the matching range
    for await (const cursor of store.iterate(range)) {
      const childSlug = cursor.value.slug.slice(prefix.length);
      children[childSlug] = cursor.value.data;
    }

    return children;
  }

  private async fetchAndCacheChildren(slug: string, customFetch: typeof fetch): Promise<DataJSONRecord> {
    const res = await customFetch(resolve("/api/world/[...slug]/children.json", { slug }));

    if (!res.ok) {
      console.error(`Failed to fetch children for ${slug}`);
      return {};
    }

    const records: DataJSONRecord = await res.json();

    if (browser && dbPromise) {
      const db = await dbPromise;
      // Use a single transaction for bulk inserts to maximize performance
      const tx = db.transaction("elements", "readwrite");
      const store = tx.objectStore("elements");

      const promises: Promise<unknown>[] = [];
      for (const [childSlug, data] of Object.entries(records)) {
        const existing = await store.get(childSlug);
        const o: CachedElement = {
          slug: childSlug,
          data: data as OsmFeature,
          modifiedAt: Date.now(),
        };
        if (existing?.childrenFetchedAt) {
          o.childrenFetchedAt = existing.childrenFetchedAt;
        }
        promises.push(store.put(o));
      }

      await Promise.all(promises);
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

    const requestKey = `stats-${slug}`;
    if (this.inFlightRequests.has(requestKey)) {
      return this.inFlightRequests.get(requestKey)!;
    }

    const promise = (async () => {
      const path = resolve("/api/world/[...slug]/stats.json", { slug });
      const res = await customFetch(path);
      if (!res.ok) {
        console.error(`Failed to fetch stats for ${slug}`);
        return undefined;
      }

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
