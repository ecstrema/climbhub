import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { browser } from "$app/env";
import type { OsmFeature } from "osm-api";
import type { DataJSONRecord } from "$lib/types";
import { resolve } from "$app/paths";
import type { AreaStats } from "$lib/types";
import type { DataJSON } from "@climbhub/climbing-data-gen";
import { getParentSlug } from "$lib/helpers/slug";

export interface CachedElement {
  slug: string;
  parentSlug?: string;
  data: DataJSON;
  nodeHash?: string;
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
  metadata: {
    key: string;
    value: string;
  };
}

// Only initialize IndexedDB if running in the browser
let dbPromise: Promise<IDBPDatabase<ClimbDataDB>> | null = null;
if (browser) {
  dbPromise = openDB<ClimbDataDB>("ClimbDataDB", 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const elementStore = db.createObjectStore("elements", { keyPath: "slug" });
        elementStore.createIndex("modifiedAt", "modifiedAt");
        elementStore.createIndex("parentSlug", "parentSlug");
        const statsStore = db.createObjectStore("stats", { keyPath: "slug" });
        statsStore.createIndex("modifiedAt", "modifiedAt");
      }
      if (oldVersion < 2) db.createObjectStore("metadata");
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
  private nodeHashesPromise?: Promise<Record<string, string> | undefined>;

  private async getNodeHashes(
    customFetch: typeof fetch,
  ): Promise<Record<string, string> | undefined> {
    if (!browser || !dbPromise) return;
    if (!this.nodeHashesPromise) {
      this.nodeHashesPromise = (async () => {
        const res = await customFetch(resolve("/api/world/node-hashes.json"), {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Failed to fetch node hashes: ${res.status}`);

        const hashes = (await res.json()) as Record<string, string>;
        const manifestHash = await this.hashText(
          Object.entries(hashes)
            .sort(([idA], [idB]) => idA.localeCompare(idB))
            .map(([id, hash]) => `${id}:${hash}`)
            .join("\n"),
        );
        await this.reconcileNodeHashes(hashes, manifestHash, await dbPromise!);
        return hashes;
      })().catch((err) => {
        console.error("Failed to reconcile cached climbing nodes:", err);
        return undefined;
      });
    }
    return this.nodeHashesPromise;
  }

  private async reconcileNodeHashes(
    hashes: Record<string, string>,
    manifestHash: string,
    db: IDBPDatabase<ClimbDataDB>,
  ) {
    const cachedElements = await db.getAll("elements");
    const previousManifestHash = await db.get("metadata", "node-hash-manifest");
    const manifestChanged = previousManifestHash !== manifestHash;
    const stale: CachedElement[] = [];
    const updated: CachedElement[] = [];

    for (const cached of cachedElements) {
      if (cached.data.type !== "node") continue;

      const expectedHash = hashes[`node:${cached.data.id}`];
      const nodeHash = cached.nodeHash ?? (await this.hashNode(cached.data as OsmFeature));
      if (nodeHash !== expectedHash) stale.push(cached);
      else if (!cached.nodeHash) updated.push({ ...cached, nodeHash });
    }

    if (stale.length === 0 && updated.length === 0 && !manifestChanged) return;

    const tx = db.transaction(["elements", "stats", "metadata"], "readwrite");
    const store = tx.objectStore("elements");
    for (const cached of updated) await store.put(cached);
    for (const cached of stale) await store.delete(cached.slug);

    if (manifestChanged) {
      for (const cached of cachedElements) {
        if (cached.childrenFetchedAt !== undefined) {
          await store.put({ ...cached, childrenFetchedAt: undefined });
        }
      }
      await tx.objectStore("stats").clear();
    }

    const staleParents = new Set(
      stale.map((cached) => cached.parentSlug).filter((slug): slug is string => slug !== undefined),
    );
    for (const parentSlug of staleParents) {
      const parent = await store.get(parentSlug);
      if (parent?.childrenFetchedAt !== undefined && !manifestChanged) {
        parent.childrenFetchedAt = undefined;
        await store.put(parent);
      }
    }
    await tx.objectStore("metadata").put(manifestHash, "node-hash-manifest");
    await tx.done;
  }

  private async invalidateCachedNode(cached: CachedElement, db: IDBPDatabase<ClimbDataDB>) {
    const tx = db.transaction("elements", "readwrite");
    const store = tx.objectStore("elements");
    await store.delete(cached.slug);
    if (cached.parentSlug !== undefined) {
      const parent = await store.get(cached.parentSlug);
      if (parent) {
        parent.childrenFetchedAt = undefined;
        await store.put(parent);
      }
    }
    await tx.done;

    const statsTx = db.transaction("stats", "readwrite");
    await statsTx.store.clear();
    await statsTx.done;
  }

  private async hashNode(node: OsmFeature): Promise<string> {
    return this.hashText(JSON.stringify(node));
  }

  private async hashText(value: string): Promise<string> {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  }

  async getNode(
    slug: string,
    customFetch: typeof fetch = globalThis.fetch,
  ): Promise<DataJSON | undefined> {
    const requestKey = `node-${slug}`;
    if (this.inFlightRequests.has(requestKey)) {
      return this.inFlightRequests.get(requestKey)!;
    }

    const promise = (async () => {
      const nodeHashes = await this.getNodeHashes(customFetch);
      if (browser && dbPromise) {
        const db = await dbPromise;
        const cached = await db.get("elements", slug);
        if (cached) {
          if (cached.data.type !== "node" || !nodeHashes) return cached.data;

          const expectedHash = nodeHashes[`node:${cached.data.id}`];
          const nodeHash = cached.nodeHash ?? (await this.hashNode(cached.data as OsmFeature));
          if (nodeHash === expectedHash) {
            if (!cached.nodeHash) await db.put("elements", { ...cached, nodeHash });
            return cached.data;
          }
          await this.invalidateCachedNode(cached, db);
        }
      }

      const res = await customFetch(resolve("/api/world/[...slug]/data.json", { slug }), {
        cache: "no-store",
      });

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
        if (data.type === "node") o.nodeHash = await this.hashNode(data as OsmFeature);
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
      await this.getNodeHashes(customFetch);
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

  private async getCachedChildren(
    slug: string,
    db: IDBPDatabase<ClimbDataDB>,
  ): Promise<DataJSONRecord> {
    const tx = db.transaction("elements", "readonly");
    const parentIndex = tx.store.index("parentSlug");
    const children = await parentIndex.getAll(slug);
    return Object.fromEntries(children.map((child) => [child.slug, child.data]));
  }

  private async fetchAndCacheChildren(
    slug: string,
    customFetch: typeof fetch,
  ): Promise<DataJSONRecord | undefined> {
    const res = await customFetch(resolve("/api/world/[...slug]/children.json", { slug }), {
      cache: "no-store",
    });

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
        const existingChildren = await store.index("parentSlug").getAll(slug);
        const fetchedSlugs = new Set(Object.keys(records));
        for (const existing of existingChildren) {
          if (!fetchedSlugs.has(existing.slug)) await store.delete(existing.slug);
        }

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
              if (data.type === "node") o.nodeHash = await this.hashNode(data as OsmFeature);
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
    await this.getNodeHashes(customFetch);
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
      const res = await customFetch(path, { cache: "no-store" });
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
