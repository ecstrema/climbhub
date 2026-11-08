# `packages/reverse-geocoding-data` Agent Guidelines

`packages/reverse-geocoding-data` maintains the worldwide geographic boundary hierarchy used to reverse-geocode climbing areas and routes into structured paths (e.g. `world/americas/north/canada/quebec/laurentides`).

---

## 1. Directory Structure of `data/`

The `data/` directory contains only directories and GeoJSON files:

- **Leaf Regions**: Every leaf region is a `<slug>.geojson` file containing a `FeatureCollection` with `Polygon` or `MultiPolygon` geometries. Example: `data/world/americas/north/canada/quebec/laurentides.geojson`.
- **Branch Regions**: Every intermediate region is a directory containing subdirectories and/or leaf `.geojson` files. An intermediate region does not have its own boundary file; its boundary is the spatial union of its children.
- **Strict Rule**: A region cannot be both a directory and a file.
- **Slugs**: All path segments and file names must be lowercase slugified strings produced by `slugify` (defined in `src/shared.ts`).

---

## 2. The 50 KB File Size Constraint

- **Hard Limit**: Pull requests cannot add or modify a GeoJSON boundary file larger than **50 KB** (checked in CI by `.github/workflows/check-boundaries.yml`).
- **Simplification**: Large polygons must be simplified before saving:
  - Use the boundary editor at `/edit-map` in the app.
  - Alternatively, use the import pipeline's built-in Douglas-Peucker simplification with topological boundary snapping.

---

## 3. Build & Hierarchy Index

The build validates the boundary directory tree and precalculates bounding boxes:

```bash
bun run build
```

- Output: `output/hierarchy-index.json`.
- Contains the recursive bounding box index for every region in `data/`.
- Consumed by `packages/climbing-data-gen` for fast spatial candidate pre-filtering.

---

## 4. OSM Boundary Importer

The importer fetches administrative boundaries from OpenStreetMap via Overpass:

- Configuration: `import/regions.ts` lists ISO codes / relation IDs and their target paths in `data/world`.
- State tracking: `import/imported.json` records previously imported boundaries so that local manual edits are not overwritten.
- Cache: `import/raw/` stores downloaded Overpass relations temporarily (uncommitted).

```bash
# Import new regions
bun run import

# Dry run (inspect what would be downloaded)
bun run import -- --dry

# Audit boundaries differing > 0.02° from OSM
bun run import -- --audit

# Re-import specific paths
bun run import -- --redo world/europe/france

# Check file sizes
bun run check-size data/world/europe/france/paris.geojson
```

---

## 5. Agent Warnings

- **Do Not Scan `data/` Blindly**: `data/` contains thousands of GeoJSON files. Running search tools without path filters will cause timeouts.
- **Snapping & Shared Borders**: Shared boundaries between neighboring regions must match vertex-for-vertex to prevent overlapping claims or dropped climbing locations during reverse geocoding.
