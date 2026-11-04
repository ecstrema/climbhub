import { browser, version } from "$app/env";
import { apiUrl } from "../network/api-url";
import type { DataJSON } from "@climbhub/climbing-data-gen";
import type { AreaStats } from "#lib/types.js";
import type { DbRequest, DbResponse, SearchFilters, TopLevelPoint } from "./types";

export type LocalDbStatus = "unknown" | "empty" | "downloading" | "ready" | "error";

type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;

export interface FilterSearch {
  next(): Promise<boolean>;
  cancel(): void;
}

/** Marks that this browser has a database for the current version, so the worker is only loaded when useful */
const MARKER_KEY = "climbhub:db-version";

/** The whole dataset in SQLite (FTS5) in a worker, in the browser's private file storage when available. */
class LocalDb {
  status = $state<LocalDbStatus>("unknown");
  /** False when the database lives in memory only, and would be lost on reload */
  persistent = $state(true);
  /** Bytes downloaded so far, and the total when the server tells it */
  loaded = $state(0);
  total = $state<number>();

  private worker?: Worker;
  private nextId = 0;
  private pending = new Map<number, { resolve: (r: DbResponse) => void; reject: (e: Error) => void }>();
  private initPromise?: Promise<void>;
  private searches = new Map<number, (slugs: string[]) => void>();

  get ready(): boolean {
    return this.status === "ready";
  }

  private send<T extends DbResponse["type"]>(
    req: DistributiveOmit<DbRequest, "id">,
    _expected?: T,
  ): Promise<Extract<DbResponse, { type: T }>> {
    this.worker ??= this.createWorker();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (r: DbResponse) => void, reject });
      this.worker!.postMessage({ ...req, id });
    });
  }

  private createWorker() {
    const worker = new Worker(new URL("./db.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<DbResponse>) => {
      if (event.data.type === "progress") {
        this.loaded = event.data.loaded;
        this.total = event.data.total;
        return;
      }
      if (event.data.type === "matchBatch") {
        this.searches.get(event.data.searchId)?.(event.data.slugs);
        return;
      }
      const entry = this.pending.get(event.data.id);
      if (!entry) return;
      this.pending.delete(event.data.id);
      if (event.data.type === "error") entry.reject(new Error(event.data.message));
      else entry.resolve(event.data);
    };
    return worker;
  }

  /** True when a previous visit already downloaded this version of the data */
  get hasMarker(): boolean {
    return browser && localStorage.getItem(MARKER_KEY) === version;
  }

  /** Opens the database and checks whether it holds the current data. Safe to call repeatedly. */
  init(): Promise<void> {
    if (!browser) return Promise.resolve();
    this.initPromise ??= this.send({ type: "status", version }, "status")
      .then((res) => {
        this.persistent = res.persistent;
        this.status = res.ready ? "ready" : "empty";
        if (!res.ready) localStorage.removeItem(MARKER_KEY);
      })
      .catch((err) => {
        console.error("Local database unavailable:", err);
        this.status = "error";
      });
    return this.initPromise;
  }

  /** Downloads the whole dataset once and stores it. */
  async download(): Promise<void> {
    await this.init();
    if (this.status === "downloading" || this.status === "ready" || this.status === "error") return;
    this.status = "downloading";
    this.loaded = 0;
    this.total = undefined;
    try {
      await this.send({ type: "build", version, url: apiUrl("", "download.json") }, "status");
      localStorage.setItem(MARKER_KEY, version);
      this.status = "ready";
    } catch (err) {
      console.error("Failed to build the local database:", err);
      this.status = "error";
    }
  }

  async getNode(slug: string): Promise<DataJSON | undefined> {
    return (await this.send({ type: "getNode", slug }, "node")).data;
  }

  async getChildren(slug: string): Promise<Record<string, DataJSON>> {
    return (await this.send({ type: "getChildren", slug }, "children")).data;
  }

  async getTopLevelPoints(): Promise<TopLevelPoint[]> {
    return (await this.send({ type: "getTopLevel" }, "topLevel")).data;
  }

  async getStats(slug: string): Promise<AreaStats | undefined> {
    return (await this.send({ type: "getStats", slug }, "stats")).data;
  }

  /** Streams the matching slugs to `onBatch`. `next()` runs for `budgetMs`, and resolves true when there are no more results. */
  filter(filters: SearchFilters, onBatch: (slugs: string[]) => void, budgetMs = 10_000): FilterSearch {
    const searchId = this.nextId++;
    this.searches.set(searchId, onBatch);
    let started = false;
    return {
      next: async () => {
        const first = !started;
        started = true;
        const res = await this.send(
          first ? { type: "filterStart", searchId, filters, budgetMs } : { type: "filterMore", searchId, budgetMs },
          "matchPause",
        );
        if (res.exhausted) this.searches.delete(searchId);
        return res.exhausted;
      },
      cancel: () => {
        this.searches.delete(searchId);
        if (started) this.worker?.postMessage({ type: "filterCancel", searchId, id: this.nextId++ });
      },
    };
  }
}

export const localDb = new LocalDb();
