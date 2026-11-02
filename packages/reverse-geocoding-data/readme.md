# reverse geocoding

The climbing places are grouped by region. A region is a path such as
`world/americas/north/canada/quebec/laurentides`, and the boundaries of the regions are committed
in `data/`.

## Structure of `data/`

`data/` only contains directories and GeoJSON files:

- Every leaf region is a `<slug>.geojson` file: a `FeatureCollection` of `Polygon` or
  `MultiPolygon`. For example `data/world/americas/north/canada/quebec/laurentides.geojson`.
- Every other region is a directory, without a boundary: its extent is the union of its children.
  A region cannot be both a directory and a file.
- Names are slugs (see `slugify` in `src/shared.ts`). The path is also the key of the display name
  of the region (translations are not done yet, so the slug is displayed for now).

A climbing place is geolocated by walking the tree: the first sibling (by slug) whose boundary
contains it wins. Places outside of every leaf are dropped.

Keep the files small: a pull request cannot add or modify a file larger than 50 KB (checked by
`.github/workflows/check-boundaries.yml`, with `bun run check-size <files>`), and the build warns
for the existing ones. Simplify them in the editor first.

## Editing the boundaries

Use the boundary editor of the app, `/edit-map`:

- With `bun run dev`, it reads `data/` directly, can run Overpass queries to get boundaries, and
  saves the changes to `data/`. Commit them as usual.
- On the deployed site, it reads `data/` from GitHub. Changes can be downloaded as a zip of the
  whole `data/` directory, or proposed directly as a pull request.

## Importing countries from OpenStreetMap

`import/regions.ts` lists the imported regions: the ISO code of their OSM relation (ISO3166-2 for a
subdivision, ISO3166-1 for a whole country) or its id, their path in `data/world`, and whether they
are a leaf or a group of their subdivisions of a given `admin_level`.

```bash
bun run import
```

It only imports the regions that were never imported (`import/imported.json` lists the others), and
never overwrites a file, so edits made in the editor are kept: a region deleted, merged or renamed
in the editor is not imported again (remove its code from `import/imported.json` to import it again):

- It downloads them one Overpass request at a time, 10s apart (retries included), into
  `import/raw/`, a cache that is not committed. A request that keeps failing is retried in the
  next pass, until everything is downloaded (20 passes at most). Run it again to resume.
- After each download, it simplifies the new boundaries (below 48 KB if possible, with a tolerance
  of at most 0.01°: larger files are listed, simplify them in the editor), keeping the shared
  borders identical, snaps them onto the borders of the existing files, and writes them to `data/`.
- A group without subdivisions at its `admin_level` is written as a single leaf.
- `-- --dry` downloads nothing and shows what `import/raw/` would add.

To repair files:

- `-- --audit` downloads every region into `import/raw/`, imported or not, and lists the files that
  are more than 0.02° away from their OSM boundary, with the command to import them again.
- `-- --redo <path>...` imports these paths of `data/world` again. A file is rebuilt in place; a
  directory is deleted and imported again, like a new region (with its `admin_level` of
  `regions.ts`).

## Build

```bash
bun install
bun run build
```

This validates `data/` and writes `output/hierarchy-index.json`, the bounding boxes of every
region, used for a fast prefilter by `packages/climbing-data-gen`. It is independent of the import:
it only reads `data/`, and runs in CI.
