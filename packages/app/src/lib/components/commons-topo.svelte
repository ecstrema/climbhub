<script lang="ts">
  import { Button } from "#components/ui/button/index.js";
  import { Input } from "#components/ui/input/index.js";
  import { Select } from "#components/ui/select/index.js";
  import { Textarea } from "#components/ui/textarea/index.js";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import UploadIcon from "@lucide/svelte/icons/upload";
  import XIcon from "@lucide/svelte/icons/x";
  import { getAppState } from "#lib/data/app-state.js";
  import { onMount, untrack } from "svelte";
  import {
    getCommonsAccessToken,
    getCommonsUsername,
    logoutCommons,
    startCommonsLogin,
    uploadCommonsFile,
  } from "#lib/data/network/commons.js";
  import type { Key, OsmFeature } from "osm-api";

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
  let loading = $state<Record<string, boolean>>({});
  let uploadOpen = $state(false);
  let commonsLoggedIn = $state(false);
  let commonsUsername = $state("");
  let uploadFile = $state<File>();
  let uploadFilename = $state("");
  let uploadDescription = $state("");
  let uploadSource = $state("");
  let uploadAuthor = $state("");
  let uploadLicense = $state("");
  let uploadRightsConfirmed = $state(false);
  let uploading = $state(false);
  let uploadStatus = $state("");
  let uploadedTitle = $state("");

  onMount(() => {
    const accessToken = getCommonsAccessToken();
    commonsLoggedIn = Boolean(accessToken);
    if (accessToken) {
      void getCommonsUsername(accessToken)
        .then((username) => (commonsUsername = username ?? "Wikimedia user"))
        .catch(() => {
          logoutCommons();
          commonsLoggedIn = false;
        });
    }
  });

  $effect(() => {
    let cancelled = false;
    for (const image of images) {
      if (!/^category:/i.test(normalizeCommonsTitle(image.title))) continue;
      loading[`resolve:${image.key}`] = true;
      void resolveCommonsImage(image.title)
        .then((resolved) => {
          if (!cancelled) resolvedImages[image.key] = resolved;
        })
        .catch(() => {
          if (!cancelled) resolvedImages[image.key] = undefined;
        })
        .finally(() => {
          if (!cancelled) loading[`resolve:${image.key}`] = false;
        });
    }
    return () => {
      cancelled = true;
    };
  });

  let displayed = $state<Record<string, (ResolvedImage & { path: string | undefined; ratio?: number }) | undefined>>(
    {},
  );

  // Show a changed image right away so it renders progressively; its path appears once loaded.
  $effect(() => {
    for (const image of images) {
      const target = imageFor(image);
      const path = tags[image.pathKey];
      // Reading `displayed` here would make this effect depend on what it writes
      const current = untrack(() => displayed[image.key]);
      if (!target) {
        if (current) displayed[image.key] = undefined;
      } else if (current?.src !== target.src) {
        displayed[image.key] = { ...target, path };
      } else if (current.path !== path || current.page !== target.page) {
        displayed[image.key] = { ...target, path, ratio: current.ratio };
      }
    }
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
      .map(({ x, y, marker, dottedAfter }) => `${x.toFixed(3)},${y.toFixed(3)}${marker}${dottedAfter ? ":" : ""}`)
      .join("|");
  }

  function pointsFor(image: CommonsImage) {
    return editingKey === image.pathKey
      ? draftPoints
      : displayed[image.key]?.ratio
        ? parsePath(displayed[image.key]?.path)
        : [];
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
    appState.setTag(featureSlug, image.pathKey as Key, value || undefined);
    cancelEdit();
  }

  async function loginCommons() {
    uploadStatus = "";
    try {
      await startCommonsLogin();
    } catch (error) {
      uploadStatus = error instanceof Error ? error.message : String(error);
    }
  }

  function selectUploadFile(event: Event) {
    uploadFile = (event.currentTarget as HTMLInputElement).files?.[0];
    uploadFilename = uploadFile?.name ?? "";
    uploadStatus = "";
  }

  function addUploadedFileToFeature() {
    if (!uploadedTitle || !appState.osmUser.loggedIn) return;
    let tagKey = "wikimedia_commons";
    if (tags[tagKey]) {
      let suffix = 1;
      while (tags[`${tagKey}:${suffix}`]) suffix++;
      tagKey = `${tagKey}:${suffix}`;
    }
    appState.setTag(featureSlug, tagKey as Key, uploadedTitle);
    uploadStatus = `${uploadedTitle} is in your pending OpenStreetMap edits.`;
    uploadedTitle = "";
  }

  async function submitUpload(event: SubmitEvent) {
    event.preventDefault();
    const accessToken = getCommonsAccessToken();
    if (!accessToken || !uploadFile || !uploadFilename.trim() || !uploadDescription.trim()) return;
    uploading = true;
    uploadStatus = "Uploading to Wikimedia Commons…";
    try {
      uploadedTitle = await uploadCommonsFile(accessToken, uploadFile, {
        filename: uploadFilename.trim(),
        description: uploadDescription.trim(),
        source: uploadSource.trim(),
        author: uploadAuthor.trim(),
        license: uploadLicense,
      });
      uploadStatus = `Uploaded ${uploadedTitle}.`;
      if (appState.osmUser.loggedIn) addUploadedFileToFeature();
    } catch (error) {
      uploadStatus = error instanceof Error ? error.message : String(error);
    } finally {
      uploading = false;
    }
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
    draftPoints = draftPoints.map((point, index) => (index === draggingPoint ? { ...point, ...position } : point));
  }

  function finishPointDrag() {
    draggingPoint = undefined;
  }

  function setSelectedMarker(event: Event) {
    if (selectedPoint === undefined) return;
    const marker = (event.currentTarget as HTMLSelectElement).value;
    draftPoints = draftPoints.map((point, index) => (index === selectedPoint ? { ...point, marker } : point));
  }

  function setSelectedDotted(event: Event) {
    if (selectedPoint === undefined) return;
    const dottedAfter = (event.currentTarget as HTMLInputElement).checked;
    draftPoints = draftPoints.map((point, index) => (index === selectedPoint ? { ...point, dottedAfter } : point));
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

<section class="flex flex-col gap-2" aria-label="Wikimedia Commons images">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <h2 class="text-sm font-semibold">Wikimedia Commons</h2>
    <Button size="xs" variant="outline" onclick={() => (uploadOpen = !uploadOpen)}>
      <UploadIcon /> Upload image
    </Button>
  </div>

  {#if uploadOpen}
    <div class="flex flex-col gap-3 border-y py-3">
      {#if !commonsLoggedIn}
        <p class="text-sm text-muted-foreground">
          Sign in with Wikimedia Commons to upload. Climbhub never asks for or stores your password.
        </p>
        <Button size="sm" variant="outline" onclick={loginCommons}>Log in with Wikimedia Commons</Button>
      {:else}
        <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span class="text-muted-foreground">Signed in as {commonsUsername || "Wikimedia user"}</span>
          <Button
            size="xs"
            variant="ghost"
            onclick={() => {
              logoutCommons();
              commonsLoggedIn = false;
              commonsUsername = "";
            }}
          >
            Log out
          </Button>
        </div>
        <form class="grid gap-3 sm:grid-cols-2" onsubmit={submitUpload}>
          <label class="grid gap-1 text-sm sm:col-span-2">
            Image file
            <Input type="file" accept="image/*" required onchange={selectUploadFile} />
          </label>
          <label class="grid gap-1 text-sm sm:col-span-2">
            Commons filename
            <Input bind:value={uploadFilename} required />
          </label>
          <label class="grid gap-1 text-sm sm:col-span-2">
            Description
            <Textarea bind:value={uploadDescription} required />
          </label>
          <label class="grid gap-1 text-sm">
            Source
            <Input bind:value={uploadSource} required />
          </label>
          <label class="grid gap-1 text-sm">
            Author
            <Input bind:value={uploadAuthor} required />
          </label>
          <label class="grid gap-1 text-sm sm:col-span-2">
            Free license
            <Select bind:value={uploadLicense} required>
              <option value="" disabled>Select a license</option>
              <option value="cc-by-sa-4.0">CC BY-SA 4.0</option>
              <option value="cc-by-4.0">CC BY 4.0</option>
              <option value="cc-zero">CC0</option>
            </Select>
          </label>
          <label class="flex items-start gap-2 text-xs text-muted-foreground sm:col-span-2">
            <input class="mt-0.5 size-4 shrink-0" type="checkbox" bind:checked={uploadRightsConfirmed} required />
            I have the rights to publish this image under the selected free license.
          </label>
          <div class="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button size="sm" type="submit" disabled={uploading || !uploadFile || !uploadRightsConfirmed}>
              <UploadIcon />
              {uploading ? "Uploading…" : "Upload to Commons"}
            </Button>
            {#if uploadedTitle && !appState.osmUser.loggedIn}
              <Button size="sm" type="button" variant="outline" onclick={() => appState.osmUser.login()}>
                Log in to OpenStreetMap to link
              </Button>
            {/if}
          </div>
        </form>
      {/if}
      {#if uploadStatus}
        <p class="text-sm text-muted-foreground" role="status">{uploadStatus}</p>
      {/if}
      {#if uploadedTitle}
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <a
            class="underline underline-offset-2"
            href={`https://commons.wikimedia.org/wiki/${encodeURIComponent(uploadedTitle.replaceAll(" ", "_"))}`}
            target="_blank"
            rel="noreferrer">Open {uploadedTitle} on Commons</a
          >
          {#if appState.osmUser.loggedIn}
            <Button size="xs" variant="outline" onclick={addUploadedFileToFeature}>Add to this feature</Button>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  {#each images as image (image.key)}
    {@const imageData = displayed[image.key]}
    {@const editing = editingKey === image.pathKey}
    {@const points = pointsFor(image)}
    <figure class="flex max-w-4xl flex-col gap-1.5">
      {#if appState.osmUser.loggedIn}
        <div class="flex flex-wrap items-center gap-1.5">
          {#if editing}
            <Button size="xs" onclick={() => saveEdit(image)}><CheckIcon /> Save path</Button>
            <Button size="xs" variant="outline" onclick={removeSelectedPoint} disabled={selectedPoint === undefined}
              ><Trash2Icon /> Remove point</Button
            >
            <label class="flex items-center gap-1 text-xs">
              Marker
              <Select
                class="h-7 w-auto py-0 px-1 text-xs"
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
              </Select>
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
            <Button size="icon-xs" variant="ghost" title="Cancel path edits" onclick={cancelEdit}><XIcon /></Button>
          {:else}
            <Button size="xs" variant="outline" onclick={() => beginEdit(image)}><PencilIcon /> Edit path</Button>
          {/if}
        </div>
      {/if}

      {#if imageData}
        <div class="group relative block overflow-hidden border bg-muted" style:aspect-ratio={imageData.ratio}>
          {#key imageData.src}
            <img
              src={imageData.src}
              alt={feature.tags?.name ?? image.title}
              class="block h-auto w-full"
              onload={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget as HTMLImageElement;
                const entry = displayed[image.key];
                if (entry && naturalWidth && naturalHeight) entry.ratio = naturalWidth / naturalHeight;
              }}
              onerror={() => (displayed[image.key] = undefined)}
            />
          {/key}
          <a
            href={imageData.page}
            target="_blank"
            rel="noreferrer"
            class="absolute end-2 top-2 z-10 inline-flex size-8 items-center justify-center rounded-md bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            aria-label="Open image on Wikimedia Commons"
            title="Open image on Wikimedia Commons"><ExternalLinkIcon class="size-4" /></a
          >
          {#if points.length > 0}
            {@const h = 1 / (imageData.ratio ?? 1)}
            <svg viewBox="0 0 1 {h}" class="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              {#each points.slice(1) as point, index (`${index}-${point.x}-${point.y}`)}
                {@const previous = points[index]!}
                <line
                  x1={previous.x}
                  y1={previous.y * h}
                  x2={point.x}
                  y2={point.y * h}
                  stroke="white"
                  stroke-width="0.009"
                  stroke-dasharray={previous.dottedAfter ? "0.018 0.012" : undefined}
                />
                <line
                  x1={previous.x}
                  y1={previous.y * h}
                  x2={point.x}
                  y2={point.y * h}
                  stroke="#e5484d"
                  stroke-width="0.004"
                  stroke-dasharray={previous.dottedAfter ? "0.018 0.012" : undefined}
                />
              {/each}
              {#each points as point, index (`${index}-${point.x}-${point.y}`)}
                <circle
                  cx={point.x}
                  cy={point.y * h}
                  r={point.marker ? 0.013 : 0.008}
                  fill={selectedPoint === index ? "#f59e0b" : point.marker ? "#2563eb" : "#e5484d"}
                  stroke="white"
                  stroke-width="0.004"
                />
                {#if point.marker}
                  <text
                    x={point.x + 0.015}
                    y={point.y * h - 0.012}
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
          {#if editing && imageData.ratio}
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
      {:else if loading[`resolve:${image.key}`] || loading[`preload:${image.key}`]}
        <p class="text-sm text-muted-foreground">Loading image…</p>
      {:else}
        <p class="text-sm text-muted-foreground">Image unavailable: {image.title}</p>
      {/if}

      {#if editError}
        <p class="text-sm text-destructive">{editError}</p>
      {/if}
    </figure>
  {/each}
</section>
