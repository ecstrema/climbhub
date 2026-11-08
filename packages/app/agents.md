# `packages/app` Agent Guidelines

`packages/app` contains the Climbhub SvelteKit application. It compiles to a static single-page web app deployed to GitHub Pages, capable of full offline browsing and in-browser OpenStreetMap editing.

---

## 1. Tech Stack & Dependencies

- **Framework**: SvelteKit with `@sveltejs/adapter-static` and Svelte 5.
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`) with `tailwind-variants` and `clsx`/`tailwind-merge` (`cn` helper).
- **Component Primitives**: Bits UI (`bits-ui`), Lucide icons (`@lucide/svelte`), custom UI atoms in `src/lib/components/ui/`.
- **Mapping & Charts**: MapLibre GL (`maplibre-gl`), LayerChart (`layerchart`), D3 scale (`d3-scale`).
- **Data & Storage**: SQLite in WebAssembly (`@sqlite.org/sqlite-wasm`) via OPFS/IndexedDB, `osm-api` for Overpass and OSM changeset submissions.
- **Localization**: Wuchale (`@wuchale/svelte`, `wuchale`), PO gettext files in `src/locales/`.

---

## 2. Directory Structure

```text
src/
|-- lib/
|   |-- components/
|   |   |-- ui/          # Atomic primitives: Button, Input, Select, Textarea, Dialog, Table, etc.
|   |   |-- editable/    # In-place editable tags: editable-tag.svelte and typed wrappers
|   |   |-- shell/       # Top navigation, responsive breadcrumbs, OSM changes modal, sidebar
|   |   |-- grade/       # HolyGrade badge component
|   |   `-- location-map.svelte # Shared MapLibre WebGL map instance
|   |-- data/
|   |   |-- app-state.ts # Unified app store (DataTree, breadcrumbs, OSM user, undo stack)
|   |   |-- db/          # local-db.svelte.js (SQLite WASM client storage & sync)
|   |   |-- network/     # OSM OAuth, Commons upload, API endpoints
|   |   |-- parse/       # OSM tags, routes, climbing styles, localized names
|   |   `-- settings.svelte.ts # Reactive localStorage user preferences
|   `-- i18n.svelte.ts   # Locale state and translation helpers
|-- locales/             # en.po, fr.po, de.po, es.po, it.po, pt.po
`-- routes/
    |-- +layout.svelte   # Root shell (progress bar, updates, theme/locale init)
    |-- +page.svelte     # Continent landing page
    |-- world/[...slug]/ # Dynamic climbing tree hierarchy (geographic, area, gym, route)
    |-- edit-map/        # Interactive boundary polygon editor
    |-- grade-comparison/ # Route/boulder/ice/aid/danger scale comparison charts
    `-- settings/        # Preferences (theme, language, grading scales, low-data, OSM)
```

---

## 3. Component & Styling Architecture Rules

### The Golden Rule: Encapsulate Tailwind Classes in Atomic Components

- **NEVER** write repeated strings of visual utility classes (e.g. `border-input bg-background shadow-xs focus-visible:ring-2 ...`) across multiple pages or layout files.
- Place all styling, variants, and interactive states in atomic components under `src/lib/components/ui/`:
  - `<Button>` (`src/lib/components/ui/button/`)
  - `<Input>` (`src/lib/components/ui/input/`)
  - `<Select>` (`src/lib/components/ui/select/`)
  - `<Textarea>` (`src/lib/components/ui/textarea/`)
  - `<Dialog.*>` (`src/lib/components/ui/dialog/`)
  - `<Table.*>` (`src/lib/components/ui/table/`)
- Compound components (e.g., page views, modals, forms) should **only** add layout and positioning styles:
  ```svelte
  <!-- GOOD: Compound component only defines layout -->
  <div class="grid gap-4 sm:grid-cols-2">
    <Input bind:value={name} placeholder="Name" />
    <Select bind:value={scale}>
      <option value="french">French</option>
    </Select>
  </div>

  <!-- BAD: Bloated classes pasted into compound layout -->
  <input
    class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
    ...
  />
  ```

### Modular Function & Component Reuse

- Keep files short (target < 100 LOC where feasible).
- Split large files by concern:
  - Route views (`routes/world/[...slug]/`) delegate to specialized child views: `geographic-page.svelte`, `area-page.svelte`, `gym-page.svelte`, `route-page.svelte`.
  - Editable metadata delegates to `editable-tag.svelte`: specialized wrappers like `editable-name.svelte` or `editable-grade.svelte` stay under 20 lines.

---

## 4. State Management & Data Patterns

### Svelte 5 Runes Patterns

- Use `$state()` for primitive values and reactive objects.
- Use `$state.raw()` for non-reactive external objects (e.g. `MapLibre` map instances, raw cached structures).
- Use `$derived()` for synchronous transformations and `$derived.by(() => ...)` for complex computations.
- Use `$props()` with explicit typing:
  ```svelte
  let { item = $bindable(), slug }: { item: DataTree; slug: string } = $props();
  ```
- Wrap reads that should not trigger effect subscriptions in `untrack(() => ...)`:
  ```ts
  $effect(() => {
    const id = page.url.searchParams.get("id");
    const found = untrack(() => appState.findOsmItemById(id));
    if (found) queriedItem = found;
  });
  ```

### AppState (`src/lib/data/app-state.ts`)

- Manages current node navigation, reactive data tree, breadcrumb hierarchy, and undo/redo operations.
- Coordinates with `osmUser` to track dirty changesets, local modifications, and submissions to the OSM API.

### LocalDb (`src/lib/data/db/local-db.svelte.js`)

- Runs SQLite WASM in the browser.
- Background worker downloads `data-version.json` and updates local tables for offline browsing and instant search.
- Honors `settings.lowData`: if low-data mode is on, it does not auto-download the worldwide dataset.

---

## 5. Development & Testing Commands

```bash
# Typecheck
bun run check

# Watch typecheck
bun run check:watch

# Run unit tests
bun run test --run

# Dev server
bun run dev

# Regenerate region name translations
bun run region-names
```
