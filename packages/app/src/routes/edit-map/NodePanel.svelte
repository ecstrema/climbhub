<script lang="ts">
  import { Button } from "#components/ui/button/index.js";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import ScanIcon from "@lucide/svelte/icons/scan";
  import PlayIcon from "@lucide/svelte/icons/play";
  import LoaderIcon from "@lucide/svelte/icons/loader-circle";
  import CombineIcon from "@lucide/svelte/icons/combine";

  import { LARGE_BOUNDARY_BYTES } from "@climbhub/reverse-geocoding-data/shared";

  import {
    hasFile,
    isPreciseCoast,
    KINDS,
    MAX_EDITABLE_VERTICES,
    nodeFile,
    nodeName,
    nodePath,
    osmName,
    walk,
    type EditorNode,
    type EditorStore,
  } from "./editor.svelte";
  import {
    cloneBoundary,
    boundaryPolygons,
    countVertices,
    mergeBoundaries,
    mergeBoundariesAtPoints,
    positionKey,
    rectangleBoundary,
    splitBoundary,
    toBoundary,
    type BBox,
  } from "./geometry";
  import { adminSubdivisionQuery, runOverpassQuery, singleAreaQuery, slugify, splitBySlug } from "./overpass";
  import { downloadBlob } from "./export";
  import { saveToDisk, stageOnDisk } from "./data-source";
  import { BOUNDARY_STATE_COLORS, MAX_STAGE_AREAS, type Boundary } from "./types";
  import type { Position } from "geojson";

  const {
    store,
    node,
    getViewBBox,
    fitTo,
    canStage = false,
  }: {
    store: EditorStore;
    node: EditorNode;
    getViewBBox: () => BBox;
    fitTo: (b: BBox) => void;
    canStage?: boolean;
  } = $props();

  const info = $derived.by(() => {
    void store.version;
    return {
      name: nodeName(node),
      osmName: osmName(node),
      path: nodePath(node),
      file: nodeFile(node),
      hasFile: hasFile(node),
      boundaryState: store.boundaryState(node),
      stageAreas: [...walk(node)].filter(hasFile).length,
      vertexCount: node.vertexCount,
      size: node.size,
      total: node.total,
      own: node.own,
      ambiguous: node.ambiguous,
      kinds: { ...node.kinds },
      unassigned: store.unassignedIn(node.bbox),
      children: node.children.length,
      coast: store.coasts.get(node),
    };
  });

  // Reset the local state when the selection changes
  let error = $state("");
  let stageMessage = $state("");
  let running = $state<string | undefined>();
  let queryDraft = $state("");
  let simplifyOpen = $state(false);
  let splitOpen = $state(false);
  let mergeOpen = $state(false);
  let coastSimplifyOpen = $state(false);
  let coastReviewTargets = $state.raw<EditorNode[]>([]);
  $effect.pre(() => {
    void node;
    error = "";
    stageMessage = "";
    simplifyOpen = false;
    splitOpen = false;
    if (!store.mergeSelection.size && !store.mergeMode) {
      mergeOpen = false;
    }
    if (!coastReviewTargets.includes(node)) {
      coastSimplifyOpen = false;
      store.preview = undefined;
    }
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

  async function stageArea() {
    const stageAreas = [...walk(node)].filter(hasFile).length;
    const confirmedLarge =
      stageAreas > MAX_STAGE_AREAS && confirm(`Are you sure you want to stage ${stageAreas} areas at once?`);
    if (stageAreas > MAX_STAGE_AREAS && !confirmedLarge) return;

    await run("stage", async () => {
      const version = store.version;
      const files = store.files();
      await saveToDisk(store.changes());
      if (store.version === version) store.markSaved(files);
      store.setGitStates(await stageOnDisk(nodePath(node), confirmedLarge));
      stageMessage = `Staged ${nodePath(node)} and its subareas with git add.`;
    });
  }

  // --- Rename ------------------------------------------------------------------------------------

  let renaming = $state(false);
  let newName = $state("");
  const newSlug = $derived(slugify(newName));

  function startRename() {
    renaming = true;
    newName = node.slug;
  }

  function applyRename() {
    try {
      store.rename(node, newSlug);
      renaming = false;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  // --- Coasts ------------------------------------------------------------------------------------

  let coastProgress = $state("");

  function findCoasts() {
    return run("coasts", async () => {
      const precise = await store.findCoasts(node, (done, total) => (coastProgress = `${done}/${total}`));
      coastProgress = "";
      error = precise.length
        ? `${precise.length} region${precise.length === 1 ? " has" : "s have"} a precise coast, marked ≈ in the tree (points per 10 km)`
        : "No region with a precise coast";
    });
  }

  // --- Coast Simplification ----------------------------------------------------------------------

  let coastMarginKm = $state(30);
  let coastToleranceKm = $state(15);
  let coastReviewIndex = $state(0);
  let coastSimplification = $state.raw<{ node: EditorNode; boundary: Boundary }[]>([]);

  const currentCoastTarget = $derived(
    coastReviewTargets.length
      ? coastReviewTargets[coastReviewIndex]
      : !node.children.length && node.boundary
        ? node
        : undefined,
  );

  const coastOffsetDegrees = $derived(coastMarginKm / 111.2);
  const coastToleranceDegrees = $derived(coastToleranceKm / 111.2);

  const coastOriginalCount = $derived(currentCoastTarget ? currentCoastTarget.vertexCount : 0);
  const coastSimplifiedCount = $derived(
    coastSimplification.length ? countVertices(coastSimplification[0]!.boundary) : 0,
  );

  function getCoastTargets(): EditorNode[] {
    if (!node.children.length && node.boundary) return [node];
    const leaves = [...walk(node)].filter((n) => !n.children.length && n.boundary);
    const precise = leaves.filter((n) => isPreciseCoast(n, store.coasts.get(n)));
    if (precise.length) return precise;
    const withCoast = leaves.filter((n) => {
      const c = store.coasts.get(n);
      return c && c.length >= 10;
    });
    return withCoast.length ? withCoast : leaves;
  }

  function openCoastSimplification() {
    coastReviewTargets = getCoastTargets();
    coastReviewIndex = 0;
    coastSimplifyOpen = true;
    simplifyOpen = splitOpen = mergeOpen = false;
    if (currentCoastTarget) {
      store.selected = currentCoastTarget;
      fitTo(currentCoastTarget.ownBBox);
    }
  }

  $effect(() => {
    if (!coastSimplifyOpen || !currentCoastTarget) return;
    void store.version;
    const target = currentCoastTarget;
    const offset = coastOffsetDegrees;
    const tol = coastToleranceDegrees;
    const timeout = setTimeout(() => {
      coastSimplification = store.simplifiedCoasts([target], {
        offsetDegrees: offset,
        tolerance: tol,
      });
      store.preview = coastSimplification[0]?.boundary;
    }, 60);
    return () => clearTimeout(timeout);
  });

  function prevCoastTarget() {
    if (coastReviewIndex > 0) {
      coastReviewIndex--;
      if (currentCoastTarget) {
        store.selected = currentCoastTarget;
        fitTo(currentCoastTarget.ownBBox);
      }
    }
  }

  function nextCoastTarget() {
    if (coastReviewIndex + 1 < coastReviewTargets.length) {
      coastReviewIndex++;
      if (currentCoastTarget) {
        store.selected = currentCoastTarget;
        fitTo(currentCoastTarget.ownBBox);
      }
    }
  }

  function acceptCoastSimplification() {
    if (!coastSimplification.length) return;
    store.applyCoastSimplification(coastSimplification);
    if (coastReviewIndex + 1 < coastReviewTargets.length) {
      coastReviewIndex++;
      if (currentCoastTarget) {
        store.selected = currentCoastTarget;
        fitTo(currentCoastTarget.ownBBox);
      }
    } else {
      coastSimplifyOpen = false;
      store.preview = undefined;
    }
  }

  function acceptAllCoastSimplifications() {
    if (!coastReviewTargets.length) return;
    const all = store.simplifiedCoasts(coastReviewTargets, {
      offsetDegrees: coastOffsetDegrees,
      tolerance: coastToleranceDegrees,
    });
    store.applyCoastSimplification(all);
    coastSimplifyOpen = false;
    store.preview = undefined;
  }

  // --- Overpass ----------------------------------------------------------------------------------

  function useQueryResult() {
    return run("use", async () => {
      const result = await runOverpassQuery(queryDraft);
      if (!result.features.length) throw new Error("The query returned no polygon");
      store.setBoundary(node, result, "Run query");
      fitTo(node.ownBBox);
    });
  }

  function splitQueryResult() {
    return run("split", async () => {
      const children = splitBySlug(await runOverpassQuery(queryDraft));
      if (!children.size) throw new Error("The query returned no named polygon");
      const { created, updated } = store.applySubdivisions(node, children);
      error = `${created} children created, ${updated} replaced.`;
      fitTo(node.bbox);
    });
  }

  let isoCode = $state("");
  let adminLevel = $state(5);

  // --- Boundary ----------------------------------------------------------------------------------

  async function importGeoJSON(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    await run("import", async () => {
      const boundary = toBoundary(JSON.parse(await file.text()));
      if (!boundary.features.length) throw new Error("No polygon in this file");
      store.setBoundary(node, boundary, "Import GeoJSON");
      fitTo(node.ownBBox);
    });
  }

  // --- Simplify ----------------------------------------------------------------------------------

  /** log10 of the tolerance in degrees */
  let toleranceLog = $state(-3);
  let scope = $state<"node" | "siblings" | "children">("siblings");
  $effect.pre(() => {
    scope = node.children.length ? "children" : "siblings";
  });
  let lockNeighbours = $state(true);
  const tolerance = $derived(10 ** toleranceLog);

  function simplifyTargets(): EditorNode[] {
    if (scope === "node") return [node];
    if (scope === "children") return [...walk(node)].filter((n) => !n.children.length);
    return node.parent?.children ?? [node];
  }

  let simplification = $state.raw<{ node: EditorNode; boundary: Boundary }[]>([]);
  const simplifiedCount = $derived(simplification.reduce((sum, s) => sum + countVertices(s.boundary), 0));
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

  // --- Vertex selection --------------------------------------------------------------------------

  const selectionCount = $derived(store.vertexSelection.size);

  function removeSelection() {
    store.removeVertices(node, [...store.vertexSelection.values()]);
    store.vertexSelection = new Map();
  }

  /** Adds a rectangle in the middle of the view, to draw a new polygon from */
  function addRectangle() {
    const view = getViewBBox();
    const [w, h] = [(view.x1 - view.x0) / 6, (view.y1 - view.y0) / 6];
    const [x, y] = [(view.x0 + view.x1) / 2, (view.y0 + view.y1) / 2];
    const rectangle = rectangleBoundary({ x0: x - w, x1: x + w, y0: y - h, y1: y + h });
    store.addPolygon(node, rectangle.features[0]!.geometry.coordinates[0] as Position[]);
    store.editing = true;
  }

  // --- Split -------------------------------------------------------------------------------------

  let splitName = $state("");
  const splitSlug = $derived(slugify(splitName));
  /** Which half goes to the new region */
  let splitSwap = $state(false);

  const split = $derived.by(() => {
    void store.version;
    const [a, b] = [...store.vertexSelection.values()];
    if (!splitOpen || !node.boundary || !a || !b || selectionCount !== 2) return;
    try {
      return { options: splitBoundary(node.boundary, a, b) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  });
  const splitOption = $derived(split?.options?.[splitSwap ? 1 : 0]);

  $effect(() => {
    if (splitOpen) store.preview = splitOption?.part;
  });

  function toggleSplit() {
    splitOpen = !splitOpen;
    simplifyOpen = false;
    mergeOpen = false;
    store.preview = undefined;
  }

  function applySplit() {
    if (!splitOption) return;
    try {
      store.split(node, splitOption.kept, splitOption.part, splitSlug);
      error = `${splitSlug} created`;
      splitName = "";
      splitOpen = false;
      store.preview = undefined;
      store.vertexSelection = new Map();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  // --- Merge -------------------------------------------------------------------------------------

  let mergeType = $state<"new" | "existing">("new");
  let newRegionName = $state("");
  const newRegionSlug = $derived(slugify(newRegionName));
  let mergeTargetId = $state<number>();

  const mergeParent = $derived.by(() => {
    if (node.children.length) return node;
    const firstSelected = [...store.mergeSelection][0];
    return firstSelected?.parent ?? node.parent ?? store.root;
  });

  const mergeCandidates = $derived.by(() => {
    void store.version;
    const parent = mergeParent;
    const candidates = parent.children.filter((c) => !c.children.length && c.boundary);
    return [...candidates, ...[...store.mergeSelection].filter((n) => !candidates.includes(n))];
  });

  $effect(() => {
    const list = [...store.mergeSelection];
    if (list.length > 0 && (!mergeTargetId || !list.some((n) => n.id === mergeTargetId))) {
      mergeTargetId = list[0]!.id;
    }
  });

  // Keep mergeOpen true whenever regions are selected or mergeMode is on
  $effect.pre(() => {
    if (store.mergeSelection.size > 0 || store.mergeMode) {
      mergeOpen = true;
      simplifyOpen = splitOpen = false;
    }
  });

  const merged = $derived.by(() => {
    void store.version;
    const items = [...store.mergeSelection];
    if (items.length < 2) return;
    return mergeBoundaries(items.map((n) => n.boundary));
  });

  $effect(() => {
    if (mergeOpen && merged) store.preview = merged;
  });

  function toggleMerge() {
    mergeOpen = !mergeOpen;
    store.mergeMode = mergeOpen;
    if (!mergeOpen) {
      store.clearMergeSelection();
      store.preview = undefined;
    }
  }

  function selectAllInGroup() {
    const parent = mergeParent;
    const candidates = parent.children.filter((c) => !c.children.length && c.boundary);
    store.setMergeSelection(candidates);
  }

  function applyMergeIntoNew() {
    const items = [...store.mergeSelection];
    if (items.length < 2 || !newRegionSlug) return;
    try {
      const created = store.mergeIntoNew(mergeParent, newRegionSlug, items, newRegionName);
      error = `${items.length} regions merged into new region "${created.slug}"`;
      newRegionName = "";
      store.clearMergeSelection();
      store.preview = undefined;
      store.mergeMode = false;
      mergeOpen = false;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  function applyMergeIntoExisting() {
    const items = [...store.mergeSelection];
    const target = items.find((n) => n.id === mergeTargetId) ?? items[0];
    if (!target || items.length < 2) return;
    const others = items.filter((n) => n !== target);
    try {
      store.merge(target, others);
      error = `${others.map((n) => n.slug).join(", ")} merged into ${target.slug}`;
      store.clearMergeSelection();
      store.preview = undefined;
      store.mergeMode = false;
      mergeOpen = false;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  const sharedNodesBetweenTwo = $derived.by(() => {
    void store.version;
    const items = [...store.mergeSelection];
    if (items.length !== 2) return [];
    const [a, b] = items;
    if (!a?.boundary || !b?.boundary) return [];
    const polysB = boundaryPolygons(b.boundary);
    const keysB = new Set<string>();
    for (const poly of polysB) {
      for (const ring of poly) {
        for (const p of ring) keysB.add(positionKey(p));
      }
    }
    const shared: Position[] = [];
    const polysA = boundaryPolygons(a.boundary);
    for (const poly of polysA) {
      for (const ring of poly) {
        for (const p of ring) {
          if (keysB.has(positionKey(p))) shared.push(p);
        }
      }
    }
    return shared;
  });

  const selectedPoints = $derived([...store.vertexSelection.values()]);

  function autoSelectCommonNodes() {
    if (sharedNodesBetweenTwo.length >= 2) {
      const p1 = sharedNodesBetweenTwo[0]!;
      const p2 = sharedNodesBetweenTwo[sharedNodesBetweenTwo.length - 1]!;
      store.vertexSelection = new Map([
        [positionKey(p1), p1],
        [positionKey(p2), p2],
      ]);
    }
  }

  function applyMergeAt2Points() {
    const items = [...store.mergeSelection];
    if (items.length !== 2 || selectedPoints.length !== 2) return;
    const [a, b] = items as [EditorNode, EditorNode];
    const [p1, p2] = selectedPoints as [Position, Position];
    try {
      if (mergeType === "new") {
        if (!newRegionSlug) return;
        const created = store.mergeAtPoints(a, b, p1, p2, store.mergeSideIndex, "new", newRegionSlug, newRegionName);
        error = `Merged ${a.slug} and ${b.slug} at 2 points into "${created.slug}"`;
        newRegionName = "";
      } else {
        const keepTarget = mergeTargetId === b.id ? "B" : "A";
        const kept = store.mergeAtPoints(a, b, p1, p2, store.mergeSideIndex, keepTarget);
        error = `Merged at 2 points into ${kept.slug}`;
      }
      store.clearMergeSelection();
      store.preview = undefined;
      store.mergeMode = false;
      mergeOpen = false;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  function applySimplification() {
    store.applySimplification(simplification);
    store.preview = undefined;
    simplifyOpen = false;
  }

  // --- Children ----------------------------------------------------------------------------------

  let childName = $state("");
  const childSlug = $derived(slugify(childName));
  let childGeometry = $state<"view" | "move" | "none">("view");

  function addChild() {
    try {
      const boundary =
        childGeometry === "view"
          ? rectangleBoundary(getViewBBox())
          : childGeometry === "move"
            ? cloneBoundary(node.boundary)
            : undefined;
      const child = store.addChild(node, childSlug, boundary);
      childName = "";
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
      {#if renaming}
        <form
          class="flex items-center gap-1.5"
          onsubmit={(e) => {
            e.preventDefault();
            applyRename();
          }}
        >
          <!-- svelte-ignore a11y_autofocus -->
          <input
            class="{inputClass} min-w-0"
            bind:value={newName}
            autofocus
            onkeydown={(e) => e.key === "Escape" && (e.stopPropagation(), (renaming = false))}
          />
          <Button size="xs" type="submit" disabled={!newSlug}>Rename</Button>
        </form>
        <p class="truncate font-mono text-xs text-muted-foreground">
          {nodePath(node.parent!)}/{newSlug || "slug"}
        </p>
      {:else}
        <h2 class="flex items-center gap-1 text-base font-semibold">
          <span class="truncate">{info.name}</span>
          {#if node.parent}
            <Button size="icon-xs" variant="ghost" title="Rename" onclick={startRename}><PencilIcon /></Button>
          {/if}
          <span class="text-xs font-normal capitalize" style:color={BOUNDARY_STATE_COLORS[info.boundaryState]}
            >{info.boundaryState}</span
          >
        </h2>
      {/if}
      <p class="truncate font-mono text-xs text-muted-foreground" title={info.path}>{info.path}</p>
      {#if info.osmName && info.osmName !== info.name}
        <p class="truncate text-xs text-muted-foreground">OSM: {info.osmName}</p>
      {/if}
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

  {#if canStage}
    <div class="flex items-center justify-between gap-2 rounded-md border p-2">
      <span class="text-xs text-muted-foreground">
        {info.stageAreas} boundary area{info.stageAreas === 1 ? "" : "s"}
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={!!running || info.stageAreas === 0}
        title="Run git add for this area and all subareas"
        onclick={stageArea}
      >
        {#if running === "stage"}<LoaderIcon class="animate-spin" />{:else}<CheckIcon />{/if}
        Stage area
      </Button>
    </div>
    {#if stageMessage}<p class="text-xs text-emerald-700">{stageMessage}</p>{/if}
  {/if}

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
    <div
      class="rounded-md bg-muted p-1.5"
      title="Places inside the bounding box which are in no region: the pipeline drops them"
    >
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

  <!-- File -->
  <section class="flex flex-col gap-2">
    <h3 class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Boundary</h3>
    <p class="text-xs">
      {#if info.children && node.boundary}
        <b class="text-rose-600">Only leaves have a boundary</b>: the boundary of this region is ignored, its {info.children}
        children are used.
        <Button size="xs" variant="ghost" onclick={() => store.setBoundary(node, undefined, "Clear boundary")}>
          Clear
        </Button>
      {:else if info.children}
        Group of {info.children} regions: a directory of data/, without boundary.
      {:else if info.hasFile}
        Saved as <code class="break-all">data/{info.file}</code>. {info.vertexCount.toLocaleString()}
        vertices,
        <span
          class:text-amber-600={info.size > LARGE_BOUNDARY_BYTES}
          class:font-semibold={info.size > LARGE_BOUNDARY_BYTES}
        >
          {Math.round(info.size / 1024).toLocaleString()} KB</span
        >{#if info.size > LARGE_BOUNDARY_BYTES}: larger than {LARGE_BOUNDARY_BYTES / 1024} KB, simplify it{/if}.
      {:else}
        <b class="text-rose-600">No boundary</b>: this region is not saved. Run a query, import or draw one.
      {/if}
    </p>
    {#if info.coast && info.coast.revision === node.revision && !info.children}
      <p class="text-xs" class:text-sky-600={isPreciseCoast(node, info.coast)}>
        Coast: {Math.round(info.coast.length).toLocaleString()} km,
        {info.coast.length ? ((info.coast.vertices / info.coast.length) * 10).toFixed(1) : 0} points per 10 km{#if isPreciseCoast(node, info.coast)}:
          more precise than needed, nothing is in the sea{/if}.
      </p>
    {/if}
    <div class="flex flex-wrap items-center gap-1.5">
      <Button
        size="xs"
        variant="outline"
        disabled={!!running}
        title="The borders with no region on the other side are coasts (or gaps): find the leaves where they have more than a point per 10 km"
        onclick={findCoasts}
      >
        {#if running === "coasts"}<LoaderIcon class="animate-spin" /> {coastProgress}{/if}
        Find precise coasts{info.children ? " in the leaves" : ""}
      </Button>
      <Button
        size="xs"
        variant={coastSimplifyOpen ? "default" : "outline"}
        disabled={!node.boundary && !info.children}
        title="Interactive preview of simplified coasts: rough circling in the water encompassing the area"
        onclick={() => {
          if (coastSimplifyOpen) {
            coastSimplifyOpen = false;
            store.preview = undefined;
          } else {
            openCoastSimplification();
          }
        }}
      >
        Simplify coasts…
      </Button>
    </div>

    {#if coastSimplifyOpen && currentCoastTarget}
      <div class="flex flex-col gap-2 rounded-md border border-rose-300 bg-rose-50/40 p-2 text-xs">
        <div class="flex items-center justify-between">
          <span class="font-semibold text-rose-800">Coast Simplification Preview</span>
          {#if coastReviewTargets.length > 1}
            <div class="flex items-center gap-1 text-muted-foreground">
              <span>{coastReviewIndex + 1} / {coastReviewTargets.length}</span>
              <Button size="icon-xs" variant="ghost" disabled={coastReviewIndex === 0} onclick={prevCoastTarget}>
                <ChevronLeftIcon />
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                disabled={coastReviewIndex + 1 >= coastReviewTargets.length}
                onclick={nextCoastTarget}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          {/if}
        </div>

        <p class="truncate font-mono text-[11px] text-muted-foreground">
          {nodePath(currentCoastTarget)}
        </p>

        <div class="flex justify-between tabular-nums">
          <span>Vertices: {coastOriginalCount} → <b>{coastSimplifiedCount}</b></span>
          {#if coastOriginalCount > 0}
            <span class="font-medium text-emerald-700">
              (-{Math.round((1 - coastSimplifiedCount / coastOriginalCount) * 100)}%)
            </span>
          {/if}
        </div>

        <label class="flex flex-col gap-1">
          <div class="flex justify-between">
            <span>Water margin</span>
            <span class="tabular-nums">{coastMarginKm} km</span>
          </div>
          <input type="range" min="5" max="80" step="5" bind:value={coastMarginKm} />
        </label>

        <label class="flex flex-col gap-1">
          <div class="flex justify-between">
            <span>Tolerance</span>
            <span class="tabular-nums">{coastToleranceKm} km</span>
          </div>
          <input type="range" min="5" max="50" step="2" bind:value={coastToleranceKm} />
        </label>

        <p class="text-[11px] text-muted-foreground">
          Dashed red line on the map. Fully encompasses the region in water. Land borders stay intact. Changes are kept
          in memory until saved.
        </p>

        <div class="flex flex-wrap items-center gap-1.5 pt-1">
          <Button
            size="xs"
            variant="ghost"
            onclick={() => {
              coastSimplifyOpen = false;
              store.preview = undefined;
            }}
          >
            Cancel
          </Button>
          <Button size="xs" onclick={acceptCoastSimplification}>
            {coastReviewTargets.length > 1 ? "Accept & Next" : "Accept"}
          </Button>
          {#if coastReviewTargets.length > 1}
            <Button size="xs" variant="outline" onclick={acceptAllCoastSimplifications}>
              Accept all ({coastReviewTargets.length})
            </Button>
          {/if}
        </div>
      </div>
    {/if}
  </section>

  <!-- Overpass -->
  <section class="flex flex-col gap-2">
    <h3 class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Overpass query</h3>
    <textarea
      class="{inputClass} h-28 font-mono text-xs"
      bind:value={queryDraft}
      placeholder={'[out:json][timeout:90];\nrelation["boundary"="administrative"]["ISO3166-2"="CA-QC"];\nout geom;'}
    ></textarea>
    <div class="flex flex-wrap items-center gap-1.5 text-xs">
      <input
        class="{inputClass} w-24"
        placeholder="FR, CA-QC"
        bind:value={isoCode}
        title="ISO3166-1 or ISO3166-2 code"
      />
      <Button
        size="xs"
        variant="outline"
        disabled={!isoCode}
        onclick={() => (queryDraft = singleAreaQuery(isoCode.trim()))}
      >
        Its boundary
      </Button>
      <Button
        size="xs"
        variant="outline"
        disabled={!isoCode}
        onclick={() => (queryDraft = adminSubdivisionQuery(isoCode.trim(), adminLevel))}
      >
        Its subdivisions
      </Button>
      <label class="flex items-center gap-1">
        admin_level
        <input class="{inputClass} w-14" type="number" min="2" max="11" bind:value={adminLevel} />
      </label>
      <a
        class="text-muted-foreground underline"
        href="https://wiki.openstreetmap.org/wiki/Tag:boundary%3Dadministrative#admin_level=*_Country_specific_values"
        target="_blank">admin_level per country</a
      >
    </div>
    <div class="flex items-center gap-1.5">
      <Button
        size="xs"
        disabled={!queryDraft || !!running || info.children > 0}
        title={info.children ? "Only leaves have a boundary" : "Use all the polygons as the boundary of this region"}
        onclick={useQueryResult}
      >
        {#if running === "use"}<LoaderIcon class="animate-spin" />{:else}<PlayIcon />{/if}
        Use as boundary
      </Button>
      <Button
        size="xs"
        variant="outline"
        disabled={!queryDraft || !!running}
        title="Each named polygon becomes a child region, named after its slug"
        onclick={splitQueryResult}
      >
        {#if running === "split"}<LoaderIcon class="animate-spin" />{:else}<PlayIcon />{/if}
        Split into children
      </Button>
    </div>
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
          splitOpen = mergeOpen = false;
          if (!simplifyOpen) store.preview = undefined;
        }}>Simplify…</Button
      >
      <Button
        size="sm"
        variant={mergeOpen || store.mergeMode || store.mergeSelection.size > 0 ? "default" : "outline"}
        title="Select and merge multiple regions together (M)"
        onclick={toggleMerge}
      >
        <CombineIcon class="size-3.5 mr-1" />
        Merge tool {store.mergeSelection.size ? `(${store.mergeSelection.size})` : "…"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={info.children > 0}
        title="Add a rectangle in the middle of the view to this region, to draw a new polygon from"
        onclick={addRectangle}>Add rectangle</Button
      >
      <label
        class:hidden={info.children > 0}
        class="inline-flex h-8 cursor-pointer items-center rounded-md border px-2.5 text-sm font-medium hover:bg-muted"
      >
        Import GeoJSON
        <input type="file" accept=".geojson,.json,application/geo+json" class="hidden" onchange={importGeoJSON} />
      </label>
      {#if node.boundary}
        <Button
          size="sm"
          variant="outline"
          onclick={() => downloadBlob(JSON.stringify(node.boundary), `${node.slug}.geojson`, "application/geo+json")}
        >
          Download
        </Button>
        <Button size="sm" variant="ghost" onclick={() => store.setBoundary(node, undefined, "Clear boundary")}>
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
        Drag a vertex to move it, drag a midpoint to add one, right-click a vertex to remove it. Shift+click a vertex to
        select it, Shift+drag to select the vertices inside a lasso.
        {store.linkVertices ? "Vertices shared with neighbours move together." : ""}
        Polygons left with fewer than 3 vertices are removed.
      </p>
      <div class="flex flex-wrap items-center gap-1.5 text-xs">
        <span class="tabular-nums">{selectionCount} selected</span>
        <Button size="xs" variant="outline" disabled={!selectionCount} onclick={removeSelection}>Delete (Del)</Button>
        <Button
          size="xs"
          variant="ghost"
          disabled={!selectionCount}
          onclick={() => (store.vertexSelection = new Map())}
        >
          Clear (Esc)
        </Button>
        <Button
          size="xs"
          variant={splitOpen ? "default" : "outline"}
          disabled={!node.parent}
          title="Cut this region along the line between two selected vertices"
          onclick={toggleSplit}>Split…</Button
        >
      </div>
      {#if splitOpen}
        <div class="flex flex-col gap-2 rounded-md border p-2 text-xs">
          {#if selectionCount !== 2}
            <p class="text-muted-foreground">
              Select exactly two vertices of the outline: the region is cut along the line between them.
            </p>
          {:else if split?.error}
            <p class="text-rose-600">{split.error}</p>
          {:else}
            <p class="text-muted-foreground">The part in red becomes a new region, next to this one.</p>
            <div class="flex items-center gap-1.5">
              <input class={inputClass} placeholder="Name of the new region" bind:value={splitName} />
              <code class="shrink-0 text-muted-foreground">{splitSlug || "slug"}</code>
            </div>
            <div class="flex items-center gap-2">
              <Button size="xs" variant="outline" onclick={() => (splitSwap = !splitSwap)}>Other side</Button>
              <span class="flex-1"></span>
              <Button size="xs" variant="ghost" onclick={toggleSplit}>Cancel</Button>
              <Button size="xs" disabled={!splitSlug} onclick={applySplit}>Split</Button>
            </div>
          {/if}
        </div>
      {/if}
    {/if}
    <label class="flex items-center gap-1.5 text-xs">
      <input type="checkbox" bind:checked={store.linkVertices} />
      Move/insert shared vertices in neighbouring regions too
    </label>

    {#if mergeOpen || store.mergeSelection.size > 0}
      {@const polygons = boundaryPolygons(merged)}
      {@const selectedList = [...store.mergeSelection]}
      {@const totalPlaces = selectedList.reduce((sum, n) => sum + n.total, 0)}
      <div
        class="flex flex-col gap-2.5 rounded-md border-2 border-rose-400 bg-rose-50/50 p-2.5 text-xs dark:bg-rose-950/20"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5 font-semibold text-rose-900 dark:text-rose-100">
            <CombineIcon class="size-4 text-rose-600" />
            <span>Merge Tool ({selectedList.length} selected)</span>
          </div>
          <div class="flex items-center gap-1">
            <Button
              size="xs"
              variant={store.mergeMode ? "default" : "outline"}
              onclick={() => (store.mergeMode = !store.mergeMode)}
            >
              {store.mergeMode ? "Mode: ON" : "Mode: OFF"}
            </Button>
            <Button size="xs" variant="ghost" onclick={toggleMerge}>Close</Button>
          </div>
        </div>

        <p class="text-muted-foreground">
          Click or Shift+drag regions on the map to add/remove them. Shared borders are dissolved.
        </p>

        <!-- Quick selection buttons -->
        <div class="flex flex-wrap items-center gap-1.5">
          {#if mergeCandidates.length > 0}
            <Button size="xs" variant="outline" onclick={selectAllInGroup}>
              Select all in {nodeName(mergeParent)} ({mergeCandidates.length})
            </Button>
          {/if}
          {#if selectedList.length > 0}
            <Button
              size="xs"
              variant="outline"
              onclick={() => {
                store.clearMergeSelection();
                store.preview = undefined;
              }}
            >
              Clear selection
            </Button>
          {/if}
        </div>

        {#if selectedList.length > 0}
          <div class="flex max-h-36 flex-wrap gap-1 overflow-y-auto rounded border bg-background/90 p-1.5">
            {#each selectedList as sel (sel.id)}
              <span class="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                <span class="max-w-[140px] truncate" title={nodeName(sel)}>{nodeName(sel)}</span>
                <span class="tabular-nums text-muted-foreground">({sel.total})</span>
                <button
                  type="button"
                  class="ml-0.5 cursor-pointer font-bold text-muted-foreground hover:text-foreground"
                  onclick={() => store.toggleMerge(sel)}
                  title="Remove from selection">&times;</button
                >
              </span>
            {/each}
          </div>

          <div class="flex items-center gap-4 border-b border-border/60 pb-1.5">
            <label class="flex cursor-pointer items-center gap-1.5 font-medium">
              <input type="radio" name="mergeType" value="new" bind:group={mergeType} />
              Into new region
            </label>
            <label class="flex cursor-pointer items-center gap-1.5 font-medium">
              <input type="radio" name="mergeType" value="existing" bind:group={mergeType} />
              Into existing region
            </label>
          </div>

          {#if selectedList.length === 2}
            <div class="flex flex-col gap-1.5 rounded border border-rose-300 bg-rose-100/50 p-2 dark:bg-rose-900/30">
              <div class="flex items-center justify-between font-semibold text-rose-950 dark:text-rose-100">
                <span>Merge at 2 Points</span>
                <span class="text-[11px] font-normal text-muted-foreground">
                  {selectedPoints.length}/2 points selected
                </span>
              </div>
              {#if selectedPoints.length === 2}
                <p class="text-[11px] text-muted-foreground">Preview shows the bridge going from Point 1 to Point 2.</p>
                <div class="flex flex-wrap items-center gap-1.5">
                  <Button size="xs" variant="outline" onclick={() => store.mergeSideIndex++}>
                    Flip side / Cycle connection
                  </Button>
                  <Button size="xs" variant="ghost" onclick={() => (store.vertexSelection = new Map())}>
                    Clear points
                  </Button>
                  <Button size="xs" variant="default" onclick={applyMergeAt2Points}>Merge at 2 points</Button>
                </div>
              {:else}
                <p class="text-[11px] text-muted-foreground">
                  Click 2 vertices on the map to bridge the 2 shapes between them.
                </p>
                {#if sharedNodesBetweenTwo.length >= 2}
                  <Button size="xs" variant="outline" class="self-start" onclick={autoSelectCommonNodes}>
                    Auto-select 2 common nodes ({sharedNodesBetweenTwo.length} found)
                  </Button>
                {/if}
              {/if}
            </div>
          {/if}

          {#if mergeType === "new"}
            <div class="flex flex-col gap-1.5">
              <label for="new-region-name" class="font-medium text-muted-foreground">New region name</label>
              <div class="flex items-center gap-1.5">
                <input
                  id="new-region-name"
                  class="{inputClass} flex-1"
                  placeholder="e.g. Kootenays"
                  bind:value={newRegionName}
                />
                <code class="shrink-0 text-muted-foreground">{newRegionSlug || "slug"}</code>
              </div>
              <div class="flex items-center justify-between pt-1">
                <span class="tabular-nums text-muted-foreground">
                  {#if merged}{polygons.length} polygon{polygons.length === 1 ? "" : "s"} ·
                  {/if}{totalPlaces} places
                </span>
                <Button size="xs" disabled={!newRegionSlug || selectedList.length < 2} onclick={applyMergeIntoNew}>
                  Create "{newRegionSlug || "..."}"
                </Button>
              </div>
            </div>
          {:else}
            <div class="flex flex-col gap-1.5">
              <label for="merge-target-region" class="font-medium text-muted-foreground">Region to keep</label>
              <select id="merge-target-region" class={inputClass} bind:value={mergeTargetId}>
                {#each selectedList as opt (opt.id)}
                  <option value={opt.id}>{nodeName(opt)} ({opt.slug})</option>
                {/each}
              </select>
              <div class="flex items-center justify-between pt-1">
                <span class="tabular-nums text-muted-foreground">
                  {#if merged}{polygons.length} polygon{polygons.length === 1 ? "" : "s"} ·
                  {/if}{totalPlaces} places
                </span>
                <Button size="xs" disabled={!mergeTargetId || selectedList.length < 2} onclick={applyMergeIntoExisting}>
                  Merge into selected
                </Button>
              </div>
            </div>
          {/if}
        {:else}
          <p class="text-muted-foreground">
            No regions selected yet. Click any region on the map or tree to select it for merging.
          </p>
        {/if}
      </div>
    {/if}

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
            <option value="children" disabled={!info.children}>every region inside this one</option>
          </select>
        </label>
        <label
          class="flex items-center gap-1.5 text-xs"
          title="Vertices shared with regions which are not simplified are kept, so that no gap or overlap appears"
        >
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

  <!-- Children -->
  <section class="flex flex-col gap-2">
    <h3 class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Add a child region</h3>
    <div class="flex items-center gap-1.5">
      <input class={inputClass} placeholder="Name" bind:value={childName} />
      <code class="shrink-0 text-xs text-muted-foreground">{childSlug || "slug"}</code>
    </div>
    <div class="flex items-center gap-1.5 text-xs">
      <select class="{inputClass} flex-1 py-0.5 text-xs" bind:value={childGeometry}>
        <option value="view">Rectangle of the current view</option>
        <option value="move" disabled={!node.boundary}>The boundary of this region</option>
        <option value="none">No boundary (run a query later)</option>
      </select>
      <Button size="xs" disabled={!childSlug} onclick={addChild}>Add</Button>
    </div>
    {#if node.boundary && !info.children}
      <p class="text-xs text-muted-foreground">Only leaves have a boundary: this region loses its own.</p>
    {/if}
  </section>

  {#if error}
    <pre class="rounded-md bg-muted p-2 text-xs whitespace-pre-wrap">{error}</pre>
  {/if}

  {#if node.parent}
    <Button size="sm" variant="destructive" class="self-start" onclick={remove}>Remove this region</Button>
  {/if}
</div>
