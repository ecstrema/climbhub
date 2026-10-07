<script lang="ts">
  import { Button } from "@/ui/button";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import ScanIcon from "@lucide/svelte/icons/scan";
  import PlayIcon from "@lucide/svelte/icons/play";
  import LoaderIcon from "@lucide/svelte/icons/loader-circle";

  import {
    KINDS,
    MAX_EDITABLE_VERTICES,
    nodeName,
    nodePath,
    nodeSource,
    type EditorNode,
    type EditorStore,
  } from "./editor.svelte";
  import { cloneBoundary, countVertices, rectangleBoundary, toBoundary, type BBox } from "./geometry";
  import {
    adminSubdivisionQuery,
    runOverpassQuery,
    singleAreaQuery,
    slugify,
    splitMultipleResult,
  } from "./overpass";
  import { downloadBlob } from "./export";
  import type { Boundary } from "./types";

  const {
    store,
    node,
    getViewBBox,
    fitTo,
  }: {
    store: EditorStore;
    node: EditorNode;
    getViewBBox: () => BBox;
    fitTo: (b: BBox) => void;
  } = $props();

  const info = $derived.by(() => {
    void store.version;
    return {
      name: nodeName(node),
      path: nodePath(node),
      displayName: node.configs.find((c) => c.file === "config.yaml")?.config.displayName ?? "",
      source: nodeSource(node),
      configs: node.configs.map((c) => ({ ...c })),
      vertexCount: node.vertexCount,
      total: node.total,
      own: node.own,
      ambiguous: node.ambiguous,
      kinds: { ...node.kinds },
      unassigned: store.unassignedIn(node.bbox),
      children: node.children.length,
      canRemove: store.canRemove(node),
    };
  });

  // Reset the local state when the selection changes
  let error = $state("");
  let running = $state<string | undefined>();
  let queryDraft = $state("");
  let simplifyOpen = $state(false);
  $effect.pre(() => {
    void node;
    error = "";
    queryDraft = node.configs.find((c) => c.file === "config.yaml")?.config.query ?? "";
    simplifyOpen = false;
    store.preview = undefined;
  });

  async function run(label: string, fn: () => Promise<void>) {
    running = label;
    error = "";
    try {
      await fn();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      running = undefined;
    }
  }

  // --- Source ------------------------------------------------------------------------------------

  function setDisplayName(value: string) {
    store.setConfig(node, "config.yaml", { displayName: value.trim() || undefined });
  }

  function runSingleQuery() {
    return run("query", async () => {
      store.setConfig(node, "config.yaml", { query: queryDraft, multiple: undefined, delegateTo: undefined });
      const result = await runOverpassQuery(queryDraft);
      if (!result.features.length) throw new Error("The query returned no polygon");
      store.setBoundary(node, result, "preview", "Run query");
      fitTo(node.ownBBox);
    });
  }

  function runMultipleQuery(owner: EditorNode, file: string) {
    return run(file, async () => {
      const query = owner.configs.find((c) => c.file === file)?.config.query;
      if (!query) throw new Error(`${file} has no query`);
      const result = await runOverpassQuery(query);
      const children = splitMultipleResult(result);
      if (!children.size) throw new Error("The query returned no named polygon");
      const { created, updated } = store.applyMultipleResult(owner, file, children);
      error = `${created} children created, ${updated} updated.`;
      fitTo(owner.bbox);
    });
  }

  /** `delegateTo` is relative to the node directory: support `../file` and `file` */
  function delegateTarget(): { owner: EditorNode; file: string } | undefined {
    const delegateTo = info.source.delegateTo;
    if (!delegateTo) return;
    if (delegateTo.startsWith("../") && node.parent) {
      return { owner: node.parent, file: delegateTo.slice(3) };
    }
    return { owner: node, file: delegateTo };
  }

  // --- Boundary ----------------------------------------------------------------------------------

  async function importGeoJSON(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    await run("import", async () => {
      const boundary = toBoundary(JSON.parse(await file.text()));
      if (!boundary.features.length) throw new Error("No polygon in this file");
      store.setBoundary(node, boundary, "edited", "Import GeoJSON");
      fitTo(node.ownBBox);
    });
  }

  function makeManual() {
    // Keep the current geometry, but export it as boundary.geojson
    store.setBoundary(node, cloneBoundary(node.boundary), "edited", "Make manual");
  }

  // --- Simplify ----------------------------------------------------------------------------------

  /** log10 of the tolerance in degrees */
  let toleranceLog = $state(-3);
  let scope = $state<"node" | "siblings" | "children">("siblings");
  let lockNeighbours = $state(true);
  const tolerance = $derived(10 ** toleranceLog);

  function simplifyTargets(): EditorNode[] {
    if (scope === "node") return [node];
    if (scope === "children") return node.children;
    return node.parent?.children ?? [node];
  }

  let simplification = $state.raw<{ node: EditorNode; boundary: Boundary }[]>([]);
  const simplifiedCount = $derived(
    simplification.reduce((sum, s) => sum + countVertices(s.boundary), 0),
  );
  const originalCount = $derived(simplification.reduce((sum, s) => sum + s.node.vertexCount, 0));

  $effect(() => {
    if (!simplifyOpen) return;
    void store.version;
    const t = tolerance;
    const targets = simplifyTargets();
    const lock = lockNeighbours;
    const timeout = setTimeout(() => {
      simplification = store.simplified(targets, t, lock);
      store.preview = {
        type: "FeatureCollection",
        features: simplification.flatMap((s) => s.boundary.features),
      };
    }, 80);
    return () => clearTimeout(timeout);
  });

  function applySimplification() {
    store.applySimplification(simplification);
    store.preview = undefined;
    simplifyOpen = false;
  }

  // --- Subdivisions ------------------------------------------------------------------------------

  let isoCode = $state("");
  let adminLevel = $state(4);
  let subdivisionFile = $state("regions.config.yaml");

  function addSubdivisionQuery() {
    const file = subdivisionFile.endsWith(".config.yaml")
      ? subdivisionFile
      : `${subdivisionFile}.config.yaml`;
    store.setConfig(node, file, {
      query: adminSubdivisionQuery(isoCode.trim(), adminLevel),
      multiple: true,
    });
    return runMultipleQuery(node, file);
  }

  function useIsoQuery() {
    queryDraft = singleAreaQuery(isoCode.trim());
  }

  // --- Children ----------------------------------------------------------------------------------

  let childName = $state("");
  let childSlug = $state("");
  const effectiveSlug = $derived(childSlug || slugify(childName));
  let childGeometry = $state<"view" | "copy" | "none">("view");

  function addChild() {
    try {
      const boundary =
        childGeometry === "view"
          ? rectangleBoundary(getViewBBox(), { name: childName })
          : childGeometry === "copy"
            ? cloneBoundary(node.boundary)
            : undefined;
      const child = store.addChild(node, effectiveSlug, childName || undefined, boundary);
      childName = childSlug = "";
      store.selected = child;
      store.editing = !!boundary;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  function remove() {
    if (!confirm(`Remove ${info.path} and its ${info.children} children?`)) return;
    store.removeNode(node);
  }

  const inputClass =
    "w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50";
</script>

<div class="flex flex-col gap-4 p-3 text-sm">
  <!-- Header -->
  <div class="flex items-start gap-2">
    <div class="min-w-0 flex-1">
      <h2 class="truncate text-base font-semibold">{info.name}</h2>
      <p class="truncate font-mono text-xs text-muted-foreground" title={info.path}>{info.path}</p>
    </div>
    <Button
      size="icon-sm"
      variant="outline"
      title="Select the parent (Esc)"
      disabled={!node.parent}
      onclick={() => (store.selected = node.parent)}><ArrowUpIcon /></Button
    >
    <Button size="icon-sm" variant="outline" title="Zoom to" onclick={() => fitTo(node.bbox)}>
      <ScanIcon />
    </Button>
  </div>

  <!-- Statistics -->
  <div class="grid grid-cols-3 gap-2 text-center">
    <div class="rounded-md bg-muted p-1.5">
      <div class="text-lg font-semibold tabular-nums">{info.total}</div>
      <div class="text-xs text-muted-foreground">places</div>
    </div>
    <div class="rounded-md bg-muted p-1.5" title="Places in overlapping sibling regions">
      <div class="text-lg font-semibold tabular-nums" class:text-amber-600={info.ambiguous}>
        {info.ambiguous}
      </div>
      <div class="text-xs text-muted-foreground">ambiguous</div>
    </div>
    <div class="rounded-md bg-muted p-1.5" title="Places inside the bounding box which are in no region: the pipeline drops them">
      <div class="text-lg font-semibold tabular-nums" class:text-rose-600={info.unassigned}>
        {info.unassigned}
      </div>
      <div class="text-xs text-muted-foreground">dropped (bbox)</div>
    </div>
  </div>
  <p class="-mt-2 text-xs text-muted-foreground">
    {KINDS.filter((k) => info.kinds[k])
      .map((k) => `${info.kinds[k]} ${k}`)
      .join(" · ") || "No climbing place"}
    {#if info.children && info.own}
      · <span class="text-rose-600">{info.own} not in any child</span>
    {/if}
  </p>

  <label class="flex flex-col gap-1">
    <span class="text-xs font-medium">Display name</span>
    <input
      class={inputClass}
      value={info.displayName}
      placeholder={info.name}
      onchange={(e) => setDisplayName(e.currentTarget.value)}
    />
  </label>

  <!-- Source -->
  <section class="flex flex-col gap-2">
    <h3 class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Boundary source</h3>
    <p class="text-xs">
      {#if node.origin === "edited"}
        <b class="text-blue-600">Edited</b>: exported as <code>boundary.geojson</code> (takes precedence over the query).
      {:else if node.origin === "manual"}
        <b>Manual</b> <code>boundary.geojson</code> in data/.
      {:else if node.origin === "preview"}
        <b class="text-rose-600">Query result</b> (not exported, the pipeline regenerates it).
      {:else if node.origin === "generated"}
        Generated by the pipeline in output/.
      {:else}
        No boundary: places are only geolocated in its children.
      {/if}
      {info.vertexCount} vertices.
    </p>

    {#if info.source.delegateTo}
      {@const target = delegateTarget()}
      <div class="flex items-center gap-2 rounded-md border p-2 text-xs">
        <span class="flex-1">Generated by <code>{info.source.delegateTo}</code></span>
        {#if target}
          <Button
            size="xs"
            variant="outline"
            disabled={!!running}
            onclick={() => runMultipleQuery(target.owner, target.file)}
          >
            {#if running === target.file}<LoaderIcon class="animate-spin" />{:else}<PlayIcon />{/if}
            Run
          </Button>
        {/if}
      </div>
    {:else}
      <details class="rounded-md border p-2" open={!!info.source.query}>
        <summary class="cursor-pointer text-xs font-medium">Overpass query (config.yaml)</summary>
        <textarea
          class="{inputClass} mt-2 h-32 font-mono text-xs"
          bind:value={queryDraft}
          placeholder={'[out:json][timeout:90];\nrelation["ISO3166-2"="CA-QC"];\nout geom;'}
        ></textarea>
        <div class="mt-1 flex items-center gap-2">
          <Button size="xs" disabled={!queryDraft || !!running} onclick={runSingleQuery}>
            {#if running === "query"}<LoaderIcon class="animate-spin" />{:else}<PlayIcon />{/if}
            Run & use
          </Button>
          {#if info.source.query && queryDraft !== info.source.query}
            <Button size="xs" variant="ghost" onclick={() => (queryDraft = info.source.query ?? "")}>
              Revert
            </Button>
          {/if}
          {#if info.source.query}
            <Button
              size="xs"
              variant="ghost"
              class="ml-auto"
              onclick={() => store.setConfig(node, "config.yaml", { query: undefined })}
            >
              Remove query
            </Button>
          {/if}
        </div>
      </details>
    {/if}
  </section>

  <!-- Boundary tools -->
  <section class="flex flex-col gap-2">
    <h3 class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Geometry</h3>
    <div class="flex flex-wrap gap-1.5">
      <Button
        size="sm"
        variant={store.editing ? "default" : "outline"}
        disabled={!node.boundary}
        onclick={() => (store.editing = !store.editing)}
      >
        {store.editing ? "Stop editing" : "Edit vertices"} (E)
      </Button>
      <Button
        size="sm"
        variant={simplifyOpen ? "default" : "outline"}
        disabled={!node.boundary && scope === "node"}
        onclick={() => {
          simplifyOpen = !simplifyOpen;
          if (!simplifyOpen) store.preview = undefined;
        }}>Simplify…</Button
      >
      <label
        class="inline-flex h-8 cursor-pointer items-center rounded-md border px-2.5 text-sm font-medium hover:bg-muted"
      >
        Import GeoJSON
        <input type="file" accept=".geojson,.json,application/geo+json" class="hidden" onchange={importGeoJSON} />
      </label>
      {#if node.boundary}
        <Button
          size="sm"
          variant="outline"
          onclick={() =>
            downloadBlob(JSON.stringify(node.boundary), `${node.slug}.geojson`, "application/geo+json")}
        >
          Download
        </Button>
        {#if node.origin === "generated" || node.origin === "preview"}
          <Button size="sm" variant="outline" title="Export the current geometry as boundary.geojson" onclick={makeManual}>
            Make manual
          </Button>
        {/if}
        <Button
          size="sm"
          variant="ghost"
          onclick={() => store.setBoundary(node, undefined, "edited", "Clear boundary")}
        >
          Clear
        </Button>
      {/if}
    </div>
    {#if store.editing && info.vertexCount > MAX_EDITABLE_VERTICES}
      <p class="text-xs text-amber-700">
        Too many vertices to edit ({info.vertexCount} &gt; {MAX_EDITABLE_VERTICES}): simplify first.
      </p>
    {:else if store.editing}
      <p class="text-xs text-muted-foreground">
        Drag a vertex to move it, drag a midpoint to add one, right-click a vertex to remove it.
        {store.linkVertices ? "Vertices shared with neighbours move together." : ""}
      </p>
    {/if}
    <label class="flex items-center gap-1.5 text-xs">
      <input type="checkbox" bind:checked={store.linkVertices} />
      Move/insert shared vertices in neighbouring regions too
    </label>

    {#if simplifyOpen}
      <div class="flex flex-col gap-2 rounded-md border p-2">
        <label class="flex flex-col gap-1 text-xs">
          <span class="flex justify-between">
            <span>Tolerance</span>
            <span class="tabular-nums">
              {tolerance.toPrecision(2)}° ≈ {Math.round(tolerance * 111_000).toLocaleString()} m
            </span>
          </span>
          <input type="range" min="-5" max="-0.5" step="0.05" bind:value={toleranceLog} />
        </label>
        <label class="flex items-center gap-2 text-xs">
          Apply to
          <select class="{inputClass} w-auto py-0.5 text-xs" bind:value={scope}>
            <option value="node">this region</option>
            <option value="siblings">this region and its siblings</option>
            <option value="children" disabled={!info.children}>the children of this region</option>
          </select>
        </label>
        <label class="flex items-center gap-1.5 text-xs" title="Vertices shared with regions which are not simplified are kept, so that no gap or overlap appears">
          <input type="checkbox" bind:checked={lockNeighbours} />
          Keep borders with other regions intact
        </label>
        <div class="flex items-center gap-2 text-xs">
          <span class="flex-1 tabular-nums">
            {originalCount.toLocaleString()} → <b>{simplifiedCount.toLocaleString()}</b> vertices
          </span>
          <Button size="xs" variant="ghost" onclick={() => ((simplifyOpen = false), (store.preview = undefined))}>
            Cancel
          </Button>
          <Button size="xs" onclick={applySimplification}>Apply</Button>
        </div>
      </div>
    {/if}
  </section>

  <!-- Subdivisions -->
  <section class="flex flex-col gap-2">
    <h3 class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      Subdivision queries (multiple: true)
    </h3>
    {#each info.configs.filter((c) => c.config.multiple) as config (config.file)}
      <div class="flex flex-col gap-1 rounded-md border p-2">
        <div class="flex items-center gap-2 text-xs">
          <code class="flex-1">{config.file}</code>
          <Button
            size="xs"
            variant="outline"
            disabled={!!running}
            onclick={() => runMultipleQuery(node, config.file)}
          >
            {#if running === config.file}<LoaderIcon class="animate-spin" />{:else}<PlayIcon />{/if}
            Run → children
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onclick={() =>
              confirm(`Remove ${config.file} and the regions it generates?`) &&
              store.removeConfig(node, config.file)}
          >
            Remove
          </Button>
        </div>
        <textarea
          class="{inputClass} h-28 font-mono text-xs"
          value={config.config.query}
          onchange={(e) => store.setConfig(node, config.file, { query: e.currentTarget.value })}
        ></textarea>
      </div>
    {/each}

    <div class="flex flex-col gap-1.5 rounded-md border border-dashed p-2 text-xs">
      <span class="font-medium">From OSM administrative boundaries</span>
      <div class="flex items-center gap-1.5">
        <input class="{inputClass} w-24" placeholder="FR, CA-QC" bind:value={isoCode} title="ISO3166-1 or ISO3166-2 code" />
        <label class="flex items-center gap-1">
          admin_level
          <input class="{inputClass} w-14" type="number" min="2" max="11" bind:value={adminLevel} />
        </label>
      </div>
      <div class="flex items-center gap-1.5">
        <input class="{inputClass} flex-1" bind:value={subdivisionFile} title="Name of the config file" />
        <Button size="xs" disabled={!isoCode || !!running} onclick={addSubdivisionQuery}>
          Add & run
        </Button>
      </div>
      <Button
        size="xs"
        variant="ghost"
        class="self-start"
        disabled={!isoCode || !!info.source.delegateTo}
        title="Fill the query of this region with the boundary of this ISO code"
        onclick={useIsoQuery}
      >
        Use as this region's own query
      </Button>
      <a
        class="text-muted-foreground underline"
        href="https://wiki.openstreetmap.org/wiki/Tag:boundary%3Dadministrative#admin_level=*_Country_specific_values"
        target="_blank">admin_level per country</a
      >
    </div>
  </section>

  <!-- Children -->
  <section class="flex flex-col gap-2">
    <h3 class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Add a child region</h3>
    <div class="flex gap-1.5">
      <input class={inputClass} placeholder="Name" bind:value={childName} />
      <input class="{inputClass} font-mono" placeholder={slugify(childName) || "slug"} bind:value={childSlug} />
    </div>
    <div class="flex items-center gap-1.5 text-xs">
      <select class="{inputClass} flex-1 py-0.5 text-xs" bind:value={childGeometry}>
        <option value="view">Rectangle of the current view</option>
        <option value="copy" disabled={!node.boundary}>Copy of this boundary</option>
        <option value="none">No boundary (set a query later)</option>
      </select>
      <Button size="xs" disabled={!effectiveSlug} onclick={addChild}>Add</Button>
    </div>
  </section>

  {#if error}
    <pre class="rounded-md bg-muted p-2 text-xs whitespace-pre-wrap">{error}</pre>
  {/if}

  {#if node.parent}
    <Button
      size="sm"
      variant="destructive"
      class="self-start"
      disabled={!info.canRemove}
      title={info.canRemove ? "" : "Generated by the query of the parent: it would come back"}
      onclick={remove}
    >
      Remove this region
    </Button>
  {/if}
</div>
