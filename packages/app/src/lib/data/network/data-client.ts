import { browser } from "$app/env";
import { apiUrl, type ApiFile } from "./api-url";
import type { DataJSON } from "@climbhub/climbing-data-gen";
import type { AreaStats, DataJSONRecord } from "#lib/types.js";
import { localDb } from "../db/local-db.svelte";
import type { MapElementFeatureCollection, TopLevelPoint } from "../db/types";
import { settings } from "../settings.svelte";
import type { DataTree } from "#lib/types.js";

/**
 * Gets the data from the local SQLite database when it holds the whole dataset, and from the
 * static API otherwise (server side, low data mode, or before the first download is finished).
 *
 * Unless the user asked for low data usage, the whole dataset is downloaded once in the background.
 */
class DataClient {
  private autoDownloadStarted = false;
  #localNodes = new Map<string, DataTree>();

  registerLocalNode(slug: string, node: DataTree) {
    this.#localNodes.set(slug, node);
  }

  unregisterLocalNode(slug: string) {
    this.#localNodes.delete(slug);
  }

  getLocalSlugByOsmId(id: string): string | undefined {
    for (const [slug, node] of this.#localNodes) {
      const feature = node.feature;
      if (feature.type !== "geographic" && `${feature.type}-${feature.id}` === id) return slug;
    }
  }

  private async localReady(): Promise<boolean> {
    if (!browser) return false;
    if (localDb.status === "ready") return true;
    if (localDb.status === "error") return false;

    if (localDb.hasMarker) {
      await localDb.init();
      if (localDb.ready) return true;
    }
    this.startAutoDownload();
    return false;
  }

  private startAutoDownload() {
    if (this.autoDownloadStarted || settings.lowData) return;
    this.autoDownloadStarted = true;
    localDb.init().then(() => {
      // Without persistent storage, the download would have to be repeated on every visit
      if (localDb.persistent && !settings.lowData) return localDb.download();
    });
  }

  private async fetchJson<T>(slug: string, file: ApiFile, customFetch: typeof fetch): Promise<T | undefined> {
    if (import.meta.env.SSR) {
      const { readApiJson } = await import("./server-files");
      return readApiJson<T>(slug, file);
    }
    const path = apiUrl(slug, file);
    const res = await customFetch(path);
    if (!res.ok) {
      console.error(`Failed to fetch ${path}`);
      return undefined;
    }
    return res.json();
  }

  async getNode(slug: string, customFetch: typeof fetch = globalThis.fetch): Promise<DataJSON | undefined> {
    const localNode = this.#localNodes.get(slug);
    if (localNode) return localNode.feature as DataJSON;
    if (await this.localReady()) {
      const data = await localDb.getNode(slug);
      if (data) return data;
    }
    return this.fetchJson<DataJSON>(slug, "data.json", customFetch);
  }

  async getChildren(slug: string, customFetch: typeof fetch = globalThis.fetch): Promise<DataJSONRecord | undefined> {
    const localNode = this.#localNodes.get(slug);
    if (localNode) {
      return Object.fromEntries(
        Object.entries(localNode.children ?? {}).map(([childSlug, child]) => [childSlug, child.feature as DataJSON]),
      );
    }
    if (await this.localReady()) return localDb.getChildren(slug);
    return this.fetchJson<DataJSONRecord>(slug, "children.json", customFetch);
  }

  /** Only available once the whole dataset is downloaded */
  async getTopLevelPoints(): Promise<TopLevelPoint[]> {
    return (await this.localReady()) ? localDb.getTopLevelPoints() : [];
  }

  async getAllMapElements(): Promise<MapElementFeatureCollection | undefined> {
    return (await this.localReady()) ? localDb.getAllMapElements() : undefined;
  }

  async getStats(slug: string, customFetch: typeof fetch = globalThis.fetch): Promise<AreaStats | undefined> {
    if (this.#localNodes.has(slug)) return undefined;
    if (await this.localReady()) return localDb.getStats(slug);
    return this.fetchJson<AreaStats>(slug, "stats.json", customFetch);
  }
}

export const dataClient = new DataClient();
