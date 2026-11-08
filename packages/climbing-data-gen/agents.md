# `packages/climbing-data-gen` Agent Guidelines

`packages/climbing-data-gen` generates the static JSON world API consumed by the frontend. It pairs worldwide OpenStreetMap climbing data with the geographic boundary regions defined in `@climbhub/reverse-geocoding-data`.

---

## 1. Pipeline Architecture

```text
Overpass API (sport=climbing)
          |
          v
  src/climbing.json (cached raw OSM response)
          |
          +<-- @climbhub/reverse-geocoding-data (output/hierarchy-index.json)
          |
          v
  Point-in-Polygon Geolocation Walker
  (first sibling boundary containing point wins)
          |
          v
  build/
    |-- world/.../<region>/data.json   (clustered climbing features)
    `-- node-hashes.json               (SHA-256 hash per OSM feature for change detection)
```

---

## 2. Key Modules

- **`src/download.ts`**: Queries the worldwide Overpass endpoint for all `sport=climbing` nodes, ways, and relations. Retries with 60s delays on timeout. Caches raw JSON in `src/climbing.json`.
- **`src/reverse-geolocation.ts`**: Evaluates point coordinates against the hierarchy bounding box index (`HIERARCHY_INDEX`), then performs precise Turf point-in-polygon checks on leaf GeoJSON boundaries.
- **`src/static-api-generator.ts`**: Partitions climbing places into regional directory buckets, formats `data.json`, and computes `node-hashes.json`.
- **`src/world-points.ts`**: Extracts lightweight point coordinates and attributes for fast spatial sorting and map rendering.

---

## 3. Commands

```bash
# Generate static API using cached src/climbing.json
bun run build

# Refresh climbing cache from Overpass and regenerate API
bun run update
```

---

## 4. Agent Warnings

- **Large Datasets**: `src/climbing.json` is over 100 MB and the `build/` output directory contains hundreds of thousands of files across gigabytes. Never run unfiltered file searches or recursive grep over this directory.
- **Deterministic Placement**: A climbing place is assigned to the first sibling by alphabetical slug whose boundary polygon contains it. Points outside of all boundaries are dropped.
- **Node Hash Invalidation**: `node-hashes.json` tracks upstream OSM modifications. If tags or geometry change on OSM, the hash mismatch alerts the frontend during synchronization.
