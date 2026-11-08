# `packages/common` Agent Guidelines

`packages/common` holds shared TypeScript interfaces, constants, and utility functions used across all packages in the Climbhub monorepo.

---

## 1. Key Responsibilities & Helpers

### OpenStreetMap Static Identifiers

- Uniform identifier format: `<type>:<id>` (e.g. `node:12345`, `way:67890`, `relation:101112`).
- Functions in `src/helpers.ts`:
  - `getStaticIdentifier(type, id)`: builds a typed `OsmIdentifier`.
  - `getTypeAndIdFromStaticIdentifier(identifier)`: parses an `OsmIdentifier`.
  - `parseOsmPathSegment(segment)`: extracts type and numeric ID from URL slugs formatted like `node-12345`.

### OSM Index Bucket Sharding

- To allow the static frontend to look up individual OSM features by ID without downloading one giant index file, index data is partitioned across 1,024 shards.
- Constant: `OSM_INDEX_BUCKETS = 1024`.
- Function: `osmIndexFile(type, id)` returns `osm-index/${type}-${id % OSM_INDEX_BUCKETS}.json`.

### Overpass Types & Query Helpers

- `src/overpass.ts` provides typed models for raw Overpass responses, geometry tags, and feature representations.

---

## 2. Invariants

- Keep this package minimal, pure, and dependency-free.
- Any helper added here must be applicable to at least two monorepo packages.
- All exports must be re-exported through `src/index.ts`.
