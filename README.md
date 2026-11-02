# Climbhub

Climbhub is a static climbing directory organized by geographic region, with grade-comparison
tools and an editor for the worldwide boundary data.

## Repository

- `packages/app/` contains the SvelteKit site, including the world directory, grade comparison, and
	boundary editor.
- `packages/reverse-geocoding-data/` contains the worldwide region boundaries and the importer and
	validation tools used to maintain them.
- `packages/climbing-data-gen/` turns worldwide OpenStreetMap climbing data and those boundaries
	into the static world API consumed by the site.
- `packages/holy-grade/` contains the climbing-grade conversion library; `packages/common/` holds
	shared utilities.

## Build

Install dependencies and build the data before building the site:

```bash
bun install
bun run build:reverse-geocoding-data
bun run build:climbing-data-gen
bun run build
```

The GitHub Pages workflow runs these same steps on pushes to `main`. It verifies that the world
directory, grade-comparison page, boundary editor, and generated worldwide API are present before
deploying the static artifact.
