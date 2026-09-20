import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { browser } from "$app/env";
import type { OsmFeature } from "osm-api";
import type { DataJSONRecord } from "$lib/types";
import { resolve } from "$app/paths";
import type { AreaStats } from "$lib/types";
import type { DataJSON } from "@climbhub/climbing-data-gen";
import { getParentSlug } from "../../helpers/slug";

export interface CachedElement {
  slug: string;
  parentSlug?: string;
  data: DataJSON;
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
    indexes: { modifiedAt: number; parentSlug?: string };
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
        const elementStore = db.createObjectStore("elements", { keyPath: "slug" });
        elementStore.createIndex("modifiedAt", "modifiedAt");
        elementStore.createIndex("parentSlug", "parentSlug");
        const statsStore = db.createObjectStore("stats", { keyPath: "slug" });
        statsStore.createIndex("modifiedAt", "modifiedAt");
      }
    },
  });
}

/**
 * Handles all fetch calls. Caches data so it doesn't always have to fetch.
 *
 * TODO: this should use sqlite-wasm instead, as it is only 1MB, and will be much faster.
 */
class DataClient {
  private inFlightRequests = new Map<string, Promise<any>>();

  async getNode(
    slug: string,
    customFetch: typeof fetch = globalThis.fetch,
  ): Promise<DataJSON | undefined> {
    const requestKey = `node-${slug}`;
    if (this.inFlightRequests.has(requestKey)) {
      return this.inFlightRequests.get(requestKey)!;
    }

    const promise = (async () => {
      if (browser && dbPromise) {
        const db = await dbPromise;
        const cached = await db.get("elements", slug);
        if (cached) return cached.data;
      }

      const res = await customFetch(resolve("/api/world/[...slug]/data.json", { slug }));

      if (!res.ok) {
        console.error(`Failed to fetch data for ${slug}`);
        return;
      }

      const data: DataJSON = await res.json();

      if (browser && dbPromise) {
        const db = await dbPromise;
        const parentSlug = getParentSlug(slug);
        const o: CachedElement = {
          slug,
          data,
          modifiedAt: Date.now(),
        };
        if (parentSlug !== undefined) o.parentSlug = parentSlug;
        await db.put("elements", o);
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
  ): Promise<DataJSONRecord | undefined> {
    const requestKey = `children-${slug}`;
    if (this.inFlightRequests.has(requestKey)) {
      return this.inFlightRequests.get(requestKey)!;
    }

    const promise = (async () => {
      if (browser && dbPromise) {
        const db = await dbPromise;
        const cached = await db.get("elements", slug);
        if (cached?.childrenFetchedAt) {
          return this.getCachedChildren(slug, db);
        }
      }

      return await this.fetchAndCacheChildren(slug, customFetch);
    })();

    this.inFlightRequests.set(requestKey, promise);
    try {
      return await promise;
    } finally {
      this.inFlightRequests.delete(requestKey);
    }
  }

  private async getCachedChildren(slug: string, db: IDBPDatabase<ClimbDataDB>): Promise<DataJSONRecord> {
    const tx = db.transaction("elements", "readonly");
    const parentIndex = tx.store.index("parentSlug");
    const children = await parentIndex.getAll(slug);
    return Object.fromEntries(children.map((child) => [child.slug, child.data]));
  }

  private async fetchAndCacheChildren(
    slug: string,
    customFetch: typeof fetch,
  ): Promise<DataJSONRecord | undefined> {
    const res = await customFetch(resolve("/api/world/[...slug]/children.json", { slug }));

    if (!res.ok) {
      console.error(`Failed to fetch children for ${slug}`);
      return undefined;
    }

    const records: DataJSONRecord = await res.json();

    (async () => {
      if (browser && dbPromise) {
        const db = await dbPromise;
        const tx = db.transaction("elements", "readwrite");
        const store = tx.objectStore("elements");

        const promises: Promise<void>[] = [];
        for (const [childSlug, data] of Object.entries(records)) {
          promises.push(
            (async () => {
              const existing = await store.get(childSlug);
              const o: CachedElement = {
                slug: childSlug,
                data: data as OsmFeature,
                modifiedAt: Date.now(),
              };
              if (slug !== undefined) o.parentSlug = slug;

              if (existing?.childrenFetchedAt) {
                o.childrenFetchedAt = existing.childrenFetchedAt;
              }
              await store.put(o);
            })(),
          );
        }

        promises.push(
          (async () => {
            const existing = await store.get(slug);
            if (existing) {
              existing.childrenFetchedAt = Date.now();
              await store.put(existing);
            }
          })(),
        );

        await Promise.all(promises);
        await tx.done;
      }
    })().catch((err) => console.error(`Background cache failed for ${slug}:`, err));

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
