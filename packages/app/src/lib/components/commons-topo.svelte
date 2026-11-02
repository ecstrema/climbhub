<script lang="ts">
  import { Button } from "@/ui/button";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import XIcon from "@lucide/svelte/icons/x";
  import { getAppState } from "$lib/data/app-state";
  import type { OsmFeature } from "osm-api";

  type CommonsImage = { key: string; pathKey: string; title: string };
  type RoutePoint = { x: number; y: number; marker: string; dottedAfter: boolean };
  type ResolvedImage = { src: string; page: string };

  const { feature, featureSlug }: { feature: OsmFeature; featureSlug: string } = $props();
  const appState = getAppState();
  const tags = $derived(feature.tags ?? {});
  const images = $derived.by(() =>
    Object.entries(tags)
      .filter(([key, value]) => /^wikimedia_commons(?::\d+)?$/.test(key) && value)
      .map(([key, title]) => ({ key, pathKey: `${key}:path`, title: title! }))
      .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true })),
  );

  let resolvedImages = $state<Record<string, ResolvedImage | undefined>>({});
  let editingKey = $state<string>();
  let draftPoints = $state<RoutePoint[]>([]);
  let selectedPoint = $state<number>();
  let draggingPoint = $state<number>();
  let editError = $state("");

  $effect(() => {
    let cancelled = false;
    for (const image of images) {
      if (!/^category:/i.test(normalizeCommonsTitle(image.title))) continue;
      void resolveCommonsImage(image.title)
        .then((resolved) => {
          if (!cancelled) resolvedImages[image.key] = resolved;
        })
        .catch(() => {
          if (!cancelled) resolvedImages[image.key] = undefined;
        });
    }
    return () => {
      cancelled = true;
    };
  });

  function parsePath(value: string | undefined): RoutePoint[] {
    if (!value) return [];
    const points: RoutePoint[] = [];
    for (const segment of value.split("|")) {
      const match = /^(\d*\.?\d+),(\d*\.?\d+)([BAPSU]?)(:?)$/.exec(segment);
      if (!match) return [];
      const x = Number(match[1]);
      const y = Number(match[2]);
      if (x < 0 || x > 1 || y < 0 || y > 1) return [];
      points.push({ x, y, marker: match[3]!, dottedAfter: match[4] === ":" });
    }
    return points;
  }

  function formatPath(points: RoutePoint[]) {
    return points
      .map(
        ({ x, y, marker, dottedAfter }) =>
          `${x.toFixed(3)},${y.toFixed(3)}${marker}${dottedAfter ? ":" : ""}`,
      )
      .join("|");
  }

  function pointsFor(image: CommonsImage) {
    return editingKey === image.pathKey ? draftPoints : parsePath(tags[image.pathKey]);
  }

  function imageFor(image: CommonsImage): ResolvedImage | undefined {
    const title = normalizeCommonsTitle(image.title);
    if (/^category:/i.test(title)) return resolvedImages[image.key];

    const file = title.replace(/^(file|image):/i, "");
    const page = `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;
    return {
      src: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1600`,
      page,
    };
  }

  function beginEdit(image: CommonsImage) {
    editingKey = image.pathKey;
    draftPoints = parsePath(tags[image.pathKey]);
    selectedPoint = undefined;
    editError = "";
  }

  function cancelEdit() {
    editingKey = undefined;
    selectedPoint = undefined;
    draggingPoint = undefined;
    editError = "";
  }

  function saveEdit(image: CommonsImage) {
    const value = formatPath(draftPoints);
    if (value.length > 255) {
      editError = "The path exceeds the 255-character OSM tag limit.";
      return;
    }
    appState.setTag(featureSlug, image.pathKey as OsmApi.Keys["keys"], value || undefined);
    cancelEdit();
  }

  function eventPosition(event: PointerEvent, target: HTMLElement) {
    const bounds = target.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
  }

  function startPointDrag(event: PointerEvent) {
    const target = event.currentTarget as HTMLButtonElement;
    const position = eventPosition(event, target);
    let nearest = -1;
    let nearestDistance = 0.035;
    for (let index = 0; index < draftPoints.length; index++) {
      const point = draftPoints[index]!;
      const distance = Math.hypot(point.x - position.x, point.y - position.y);
      if (distance < nearestDistance) {
        nearest = index;
        nearestDistance = distance;
      }
    }

    event.preventDefault();
    if (nearest >= 0) {
      selectedPoint = nearest;
      draggingPoint = nearest;
    } else {
      draftPoints = [...draftPoints, { ...position, marker: "", dottedAfter: false }];
      selectedPoint = draftPoints.length - 1;
      draggingPoint = selectedPoint;
    }
    target.setPointerCapture(event.pointerId);
  }

  function movePoint(event: PointerEvent) {
    if (draggingPoint === undefined) return;
    const position = eventPosition(event, event.currentTarget as HTMLButtonElement);
    draftPoints = draftPoints.map((point, index) =>
      index === draggingPoint ? { ...point, ...position } : point,
    );
  }

  function finishPointDrag() {
    draggingPoint = undefined;
  }

  function setSelectedMarker(event: Event) {
    if (selectedPoint === undefined) return;
    const marker = (event.currentTarget as HTMLSelectElement).value;
    draftPoints = draftPoints.map((point, index) =>
      index === selectedPoint ? { ...point, marker } : point,
    );
  }

  function setSelectedDotted(event: Event) {
    if (selectedPoint === undefined) return;
    const dottedAfter = (event.currentTarget as HTMLInputElement).checked;
    draftPoints = draftPoints.map((point, index) =>
      index === selectedPoint ? { ...point, dottedAfter } : point,
    );
  }

  function removeSelectedPoint() {
    if (selectedPoint === undefined) return;
    draftPoints = draftPoints.filter((_, index) => index !== selectedPoint);
    selectedPoint = undefined;
  }

  async function resolveCommonsImage(value: string): Promise<ResolvedImage | undefined> {
    const title = normalizeCommonsTitle(value);
    const page = `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;

    if (/^category:/i.test(title)) {
      const params = new URLSearchParams({
        action: "query",
        generator: "categorymembers",
        gcmtitle: title,
        gcmtype: "file",
        gcmlimit: "1",
        prop: "imageinfo",
        iiprop: "url",
        iiurlwidth: "1600",
        format: "json",
        origin: "*",
      });
      const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
      if (!response.ok) return;
      const data = await response.json();
      const pages = Object.values(data.query?.pages ?? []) as {
        imageinfo?: { thumburl?: string; url?: string }[];
      }[];
      const imageInfo = pages[0]?.imageinfo?.[0];
      const src = imageInfo?.thumburl ?? imageInfo?.url;
      return src ? { src, page } : undefined;
    }

    return;
  }

  function normalizeCommonsTitle(value: string) {
    return value
      .trim()
      .replace(/^https?:\/\/commons\.wikimedia\.org\/wiki\//i, "")
      .replaceAll("_", " ");
  }
</script>

{#if images.length > 0}
  <section class="flex flex-col gap-2" aria-label="Wikimedia Commons images">
    {#each images as image (image.key)}
      {@const imageData = imageFor(image)}
      {@const editing = editingKey === image.pathKey}
      {@const points = pointsFor(image)}
      <figure class="flex max-w-4xl flex-col gap-1.5">
        {#if appState.osmUser.loggedIn}
          <div class="flex flex-wrap items-center gap-1.5">
            {#if editing}
              <Button size="xs" onclick={() => saveEdit(image)}><CheckIcon /> Save path</Button>
              <Button
                size="xs"
                variant="outline"
                onclick={removeSelectedPoint}
                disabled={selectedPoint === undefined}><Trash2Icon /> Remove point</Button
              >
              <label class="flex items-center gap-1 text-xs">
                Marker
                <select
                  class="h-7 rounded-md border bg-background px-1"
                  value={selectedPoint === undefined ? "" : draftPoints[selectedPoint]?.marker}
                  onchange={setSelectedMarker}
                  disabled={selectedPoint === undefined}
                >
                  <option value="">None</option>
                  <option value="B">Bolt / ring</option>
                  <option value="A">Anchor</option>
                  <option value="P">Piton</option>
                  <option value="S">Fixed sling</option>
                  <option value="U">Unfinished</option>
                </select>
              </label>
              <label class="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={selectedPoint !== undefined && draftPoints[selectedPoint]?.dottedAfter}
                  onchange={setSelectedDotted}
                  disabled={selectedPoint === undefined || selectedPoint === draftPoints.length - 1}
                />
                Dotted after
              </label>
              <Button size="icon-xs" variant="ghost" title="Cancel path edits" onclick={cancelEdit}
                ><XIcon /></Button
              >
            {:else}
              <Button size="xs" variant="outline" onclick={() => beginEdit(image)}
                ><PencilIcon /> Edit path</Button
              >
            {/if}
          </div>
        {/if}

        {#if imageData}
          <div class="group relative block overflow-hidden border bg-muted">
            <img
              src={imageData.src}
              alt={feature.tags?.name ?? image.title}
              class="block h-auto w-full"
              loading="lazy"
            />
            <a
              href={imageData.page}
              target="_blank"
              rel="noreferrer"
              class="absolute end-2 top-2 z-10 inline-flex size-8 items-center justify-center rounded-md bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              aria-label="Open image on Wikimedia Commons"
              title="Open image on Wikimedia Commons"><ExternalLinkIcon class="size-4" /></a
            >
            {#if points.length > 0}
              <svg
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                class="pointer-events-none absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                {#each points.slice(1) as point, index (`${index}-${point.x}-${point.y}`)}
                  {@const previous = points[index]!}
                  <line
                    x1={previous.x}
                    y1={previous.y}
                    x2={point.x}
                    y2={point.y}
                    stroke="white"
                    stroke-width="0.009"
                    stroke-dasharray={previous.dottedAfter ? "0.018 0.012" : undefined}
                  />
                  <line
                    x1={previous.x}
                    y1={previous.y}
                    x2={point.x}
                    y2={point.y}
                    stroke="#e5484d"
                    stroke-width="0.004"
                    stroke-dasharray={previous.dottedAfter ? "0.018 0.012" : undefined}
                  />
                {/each}
                {#each points as point, index (`${index}-${point.x}-${point.y}`)}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={point.marker ? 0.013 : 0.008}
                    fill={selectedPoint === index
                      ? "#f59e0b"
                      : point.marker
                        ? "#2563eb"
                        : "#e5484d"}
                    stroke="white"
                    stroke-width="0.004"
                  />
                  {#if point.marker}
                    <text
                      x={point.x + 0.015}
                      y={point.y - 0.012}
                      fill="white"
                      stroke="#111827"
                      stroke-width="0.003"
                      paint-order="stroke"
                      font-size="0.035"
                      font-weight="bold">{point.marker}</text
                    >
                  {/if}
                {/each}
              </svg>
            {/if}
            {#if editing}
              <button
                type="button"
                class="absolute inset-0 h-full w-full cursor-crosshair touch-none bg-transparent p-0"
                aria-label="Add or move route points on the image"
                onpointerdown={startPointDrag}
                onpointermove={movePoint}
                onpointerup={finishPointDrag}
                onpointercancel={finishPointDrag}
              ></button>
            {/if}
          </div>
        {:else}
          <p class="text-sm text-muted-foreground">Image unavailable: {image.title}</p>
        {/if}

        {#if editError}
          <p class="text-sm text-destructive">{editError}</p>
        {/if}
      </figure>
    {/each}
  </section>
{/if}
