import { self } from "$app/service-worker";
import { version } from "$app/env";
import { immutable, assets } from "$app/manifest";
import { resolve } from "$app/paths";

// Create a unique cache name for this deployment
const APP_CACHE = `APP-${version}`;

const ASSETS = [
  ...immutable.map((a) => resolve(a.path)), // the app itself
  ...assets.map((a) => resolve(a.path)), // everything in `static`
];

self.addEventListener("install", (event) => {
  // Create a new cache and add all files to it
  async function addFilesToCache() {
    if (!import.meta.env.DEV) {
      const cache = await caches.open(APP_CACHE);
      await cache.addAll(ASSETS);
    }
  }

  event.waitUntil(addFilesToCache());
});

self.addEventListener("activate", (event) => {
  // Remove previous cached data from disk
  async function deleteOldCaches() {
    for (const key of await caches.keys()) {
      // Delete old app caches
      if (key !== APP_CACHE) {
        await caches.delete(key);
      }
    }
  }

  event.waitUntil(deleteOldCaches());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Cross-origin requests (map tiles...) go straight to the network: the cache is keyed by pathname.
  if (url.origin !== self.location.origin) return;

  // Climbing data is handled by the local SQLite database, or fetched directly in low data mode.
  if (url.pathname.startsWith("/climbhub/api/world")) {
    return;
  }

  // SvelteKit's update check must always hit the network, a cached copy makes it report stale versions.
  if (url.pathname.endsWith("/_app/version.json")) return;

  event.respondWith(handleAppFile(event.request, url.pathname));
});

// App files. Those are automatically up to date, because when a new service worker is installed,
// it installs the new version of the app too, and uninstalls the old version.
async function handleAppFile(request: Request, pathname: string): Promise<Response> {
  const appCache = await caches.open(APP_CACHE);
  return import.meta.env.DEV ? safeFetch(request) : safeFetchWithCache(appCache, pathname, request);
}

async function safeFetchWithCache(cache: Cache, pathname: string, request: Request) {
  return (await cache.match(pathname)) || (await safeFetchAndCache(cache, pathname, request));
}

async function safeFetchAndCache(cache: Cache, pathname: string, request: Request) {
  const res = await safeFetch(request);
  if (res.status === 200 && !res.headers.get("cache-control")?.includes("no-store")) {
    // do not await to do it in the background
    cache.put(pathname, res.clone());
  }
  return res;
}

/** if we're offline, fetch can return a value that is not a Response instead of throwing - and we can't pass this non-Response to respondWith, so we throw here */
async function safeFetch(request: Request) {
  const res = await fetch(request);
  if (!(res instanceof Response)) {
    throw new Error("invalid response from fetch");
  }
  return res;
}
