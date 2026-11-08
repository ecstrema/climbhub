# Climbhub Agent Guidelines

Welcome to the Climbhub codebase. This document outlines the architecture, engineering principles, and operational rules for AI agents working across the repository.

---

## 1. Monorepo Overview & Package Architecture

Climbhub is a Bun workspace monorepo powering a static climbing directory organized by geographic region, an interactive map and boundary editor, and international grade comparison tools.

### Data Flow Architecture

```text
               +----------------------------------+
               | OpenStreetMap (Overpass API)     |
               +-----------------+----------------+
                                 |
         +-----------------------+-----------------------+
         |                                               |
         v                                               v
+-------------------------------+             +---------------------------+
| packages/                     |             | packages/                 |
| reverse-geocoding-data        |             | climbing-data-gen         |
| Worldwide boundary GeoJSON    |             | Downloads climbing data,  |
| and hierarchy index           |             | geo-locates into regions, |
+---------------+---------------+             | outputs static JSON API   |
                |                             +-------------+-------------+
                |                                           |
                +---------------------+---------------------+
                                      |
                                      v
                        +---------------------------+
                        | packages/app              |
                        | SvelteKit static site     |
                        | MapLibre maps, editor     |
                        | Client SQLite cache       |
                        +---------------------------+
                                      ^
                                      |
         +----------------------------+----------------------------+
         |                                                         |
+-------------------------------+                         +---------------------------+
| packages/holy-grade           |                         | packages/common           |
| Climbing grade conversion     |                         | Shared types, OSM IDs,    |
| & reference rankings          |                         | index sharding utils      |
+-------------------------------+                         +---------------------------+
```

### Package Responsibilities

- **`packages/app`**: SvelteKit static PWA. Built with Svelte 5 runes, Tailwind CSS v4, MapLibre GL, SQLite WASM client cache, OSM API integration, boundary editor.
- **`packages/reverse-geocoding-data`**: Leaf GeoJSON region boundaries (`data/world/...`), simplification tools, validation, and Overpass importer.
- **`packages/climbing-data-gen`**: Downloads global OSM climbing data (`sport=climbing`), geolocates points against boundaries, generates static API and SHA-256 node hashes.
- **`packages/holy-grade`**: Universal climbing grade conversion library (Route, Boulder, Ice, Aid, Danger scales) using numeric reference rankings.
- **`packages/common`**: Shared TypeScript types, OSM identifier parsers (`getStaticIdentifier`), and index sharding helpers (`OSM_INDEX_BUCKETS`).

---

## 2. Core Engineering Philosophy

### Minimize Lines of Code (LOC)

- Write concise, declarative, readable code. Avoid ceremonial boilerplate and unnecessary abstraction layers.
- Prefer small, pure, reusable functions for data transformations, string parsing, and geometry calculations.
- Reuse existing helpers in `packages/common/src/helpers.ts` and `packages/app/src/lib/` before adding new utilities.

### Component & Styling Architecture

- **Isolate Large Tailwind Utility Strings in Base/Atomic Components**:
  - Base components (e.g. `packages/app/src/lib/components/ui/`) encapsulate design tokens, interaction states, focus rings, shadows, and borders (e.g. `<Button>`, `<Input>`, `<Select>`, `<Textarea>`, `<Dialog>`).
  - High-level composite/compound components and pages (`routes/**`, feature components) must **never** repeat long chains of Tailwind utility classes.
  - Compound components should only add layout and spacing classes on top (e.g., `flex gap-2 items-center`, `grid sm:grid-cols-2 gap-4`, margins/padding).
- **Zero Duplicated Inline Class Chunks**:
  - If a specific HTML element or styled container repeats across two or more places with identical or near-identical Tailwind styling, extract it into a small atomic component or a reusable Svelte snippet (`{#snippet ...}`).
  - Domain-specific editable components follow this exact model: `editable-tag.svelte` handles the input mechanics, tooltip, and undo stack, while `editable-name.svelte`, `editable-description.svelte`, and `editable-length.svelte` are simple, focused 10-line wrappers.

### Svelte 5 Runes Standard

- **Always use Svelte 5 runes**: `$state`, `$state.raw`, `$derived`, `$derived.by`, `$props`, `$bindable`, `$effect`.
- **Never use legacy Svelte 3/4 syntax**: Do not write `export let`, `$:` reactive declarations, or `<slot>`. Use `$props()`, `$derived()`, and `{#snippet}` / `{@render}` instead.
- **Prevent Reactivity Loops**: When reading state inside `$effect` or lifecycle callbacks (such as tree-walk lookups or navigation updates), wrap non-triggering reads in `untrack(() => ...)` to avoid unintended subscriptions.

---

## 3. Directory of Nested `agents.md`

Detailed architecture and development guidelines for individual packages are located in their respective directories:

- [`packages/app/agents.md`](packages/app/agents.md) — SvelteKit site, client state (`AppState`, `LocalDb`, `Settings`), UI components, routes, i18n, and styling.
- [`packages/reverse-geocoding-data/agents.md`](packages/reverse-geocoding-data/agents.md) — Boundary GeoJSON structure, 50 KB file size limits, hierarchy indexing, and Overpass boundary imports.
- [`packages/climbing-data-gen/agents.md`](packages/climbing-data-gen/agents.md) — Static API generation, point-in-polygon matching, and node hash change tracking.
- [`packages/holy-grade/agents.md`](packages/holy-grade/agents.md) — Grade scale definitions, reference rankings, bidirectional conversions, and danger rating parsing.
- [`packages/common/agents.md`](packages/common/agents.md) — Shared types, static identifiers, and OSM index sharding.

---

## 4. Essential Commands for Agents

Always run commands using `bun` (the workspace package manager):

```bash
# Typecheck the app
bun run check

# Run unit tests in packages/app
cd packages/app && bun run test --run

# Run unit tests in packages/holy-grade
cd packages/holy-grade && bun test

# Build data artifacts then the static site
bun run build:reverse-geocoding-data
bun run build:climbing-data-gen
bun run build
```

---

## 5. Critical Pitfalls to Avoid

1. **Massive Directories**: `packages/reverse-geocoding-data/data/`, `packages/app/build/`, and `packages/climbing-data-gen/build/` contain hundreds of megabytes or gigabytes of JSON and GeoJSON files.
   - **Never run unpruned `find` or `grep` commands across the workspace root**. Always prune or exclude `data`, `build`, `node_modules`, `.svelte-kit`, and `.git`.
2. **50 KB Boundary Limit**: Region boundaries in `packages/reverse-geocoding-data/data` cannot exceed 50 KB. Any modification or creation must be simplified to respect this constraint.
3. **Svelte Runes Mutability**: When mutating arrays or objects in `$state`, ensure reactivity triggers correctly. Use `$state.raw` when storing non-reactive instances (like MapLibre maps or large caches).
4. **Static Deployment**: The application deploys as a static site (GitHub Pages). Server routes (`+server.ts`) must only be used for dev tooling or pre-rendering; runtime operations must run entirely in the browser using static API fetch or direct Overpass/OSM calls.
