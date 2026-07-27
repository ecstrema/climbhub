// Disables access to DOM typings like `HTMLElement` which are not available
// inside a service worker and instantiates the correct globals
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Ensures that the `$service-worker` import has proper type definitions
/// <reference types="@sveltejs/kit" />

// Only necessary if you have an import from `$env/static/public`
/// <reference types="../.svelte-kit/ambient.d.ts" />

import { build, files, version } from "$service-worker";
import { json } from "@sveltejs/kit";

import type { DataJSONRecord } from "./lib/types";

// This gives `self` the correct types
const self = globalThis.self as unknown as ServiceWorkerGlobalScope;

// Create a unique cache name for this deployment
const APP_CACHE = `APP-${version}`;
const CLIMBING_DATA_CACHE = `CLIMBING_DATA`;

const ASSETS = [
  ...build, // the app itself, without any json file
  ...files, // everything in `static`
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
      if (key !== APP_CACHE || key !== CLIMBING_DATA_CACHE) await caches.delete(key);
    }
  }

  event.waitUntil(deleteOldCaches());
});

self.addEventListener("fetch", (event) => {
  // for now, cache only GET requests. The others will require more treatment.
  if (event.request.method !== "GET") return;

  event.respondWith(handleFetchGet(event.request));
});

async function handleFetchGet(request: Request): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  const isClimbingData = pathname.startsWith("/climbhub/api/world");

  if (isClimbingData) {
    return handleClimbingData(request, pathname);
  }
  return handleAppFile(request, pathname);
}

// TODO: instead of no caching in dev, use hot reloading to clear cache for modified modules.
// import.meta.hot?.on("vite:beforeUpdate", (p) => {
//   for (const u of p.updates) {
//     console.log(u.path);
//   }
// });

/**
 * We store data.json. When we get a children.json, we delete the included data.json, and when we get a deep.json, we delete the included data.json and children.json.
 * That means that when we fetch a path/to/the/data.json, we must check all these locations:
 *  - path/to/the/data.json
 *  - path/to/children.json
 *  - path/deep.json
 *  - deep.json
 */
async function handleClimbingData(request: Request, pathname: string): Promise<Response> {
  const climbingDataCache = await caches.open(CLIMBING_DATA_CACHE);

  // The path is /climbhub/api/world/[...slug]/[data/children].json
  // For /climbhub/api/world/path/to/the/data.json
  const segments = pathname.split("/"); // ["", "climbhub", "api", "world", "path", "to", "the", "data.json"]
  const slugSegments = segments.slice(4, -1); // ["path", "to", "the"]
  const slug = slugSegments.join("/"); // "path/to/the"
  const filename = segments.at(-1)!; // "data.json"

  const parentSlugs: string[] = [];
  // We could make this branchless by using an iterator, and skipping the first iteration after initializing correctly parentSlugs.
  for (const segment of slugSegments) {
    const last = parentSlugs.at(-1);
    parentSlugs.push(last ? `${last}/${segment}` : segment);
  }

  if (filename === "deep.json") {
    console.error(
      `${slug}/deep.json called from the frontend. This endpoint is reserved to the service worker to make faster downloads when only children.json is available.`,
    );
    return safeFetch(request);
  }

  if (filename === "data.json") {
    // Check if there is a parent children.json, or simultaneously, check if there is a deep.json
    let childrenURL: string | null;
    switch (slugSegments.length) {
      case 0:
        childrenURL = null;
        break;
      case 1:
        childrenURL = "/climbhub/api/world/children.json";
        break;

      default:
        const parentSlug = parentSlugs.at(-2)!;
        childrenURL = "/climbhub/api/world/" + parentSlug + "/children.json";
        break;
    }
    const toCheck: [string, string | null] = [
      slug ? "/climbhub/api/world/" + slug + "/data.json" : "/climbhub/api/world/data.json",
      childrenURL,
    ];
    const [dataRes, childrenRes] = await Promise.all(
      toCheck.map((target) => (target ? climbingDataCache.match(target) : null)),
    );
    if (dataRes) {
      return dataRes;
    }

    if (childrenRes) {
      const children = await childrenRes.json();
      const data = children[slug];
      if (data) {
        return json(data);
      }
    }
    return safeFetchWithCache(climbingDataCache, pathname, request);
  } else if (filename === "children.json") {
    const res = await safeFetchWithCache(climbingDataCache, pathname, request);

    // Delete all data.json contained in this children.json
    res
      .clone() // We have to clone else we get: a Response whose "body" is locked cannot be used to respond to a request.
      .json()
      .then((v: DataJSONRecord) => {
        for (const key of Object.keys(v)) {
          climbingDataCache.delete(key);
        }
      });
    return res;
  } else return safeFetchAndCache(climbingDataCache, request);
}

// App files. Those are automatically up to date, because when a new service worker is installed, it installs the new version of the app too, and uninstalls the old version.
async function handleAppFile(request: Request, pathname: string): Promise<Response> {
  const appCache = await caches.open(APP_CACHE);
  return import.meta.env.DEV ? safeFetch(request) : safeFetchWithCache(appCache, pathname, request);
}

async function safeFetchWithCache(
  cache: Cache,
  pathname: string,
  ...params: Parameters<typeof safeFetch>
) {
  return (await cache.match(pathname)) || (await safeFetchAndCache(cache, ...params));
}

async function safeFetchAndCache(cache: Cache, ...params: Parameters<typeof safeFetch>) {
  const res = await safeFetch(...params);
  if (res.status === 200 && !res.headers.get("cache-control")?.includes("no-store")) {
    // do not await to do it in the background
    cache.put(params[0], res.clone());
  }
  return res;
}

/** if we're offline, fetch can return a value that is not a Response instead of throwing - and we can't pass this non-Response to respondWith, so we throw here */
async function safeFetch(...params: Parameters<typeof fetch>) {
  const res = await fetch(...params);
  if (!(res instanceof Response)) {
    throw new Error("invalid response from fetch");
  }
  return res;
}
