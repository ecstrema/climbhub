<script lang="ts">
  import { base } from "$app/paths";
  import { Button } from "@/ui/button";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import SaveIcon from "@lucide/svelte/icons/save";
  import GitPullRequestIcon from "@lucide/svelte/icons/git-pull-request";
  import Undo2Icon from "@lucide/svelte/icons/undo-2";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import LoaderIcon from "@lucide/svelte/icons/loader-circle";
  import CombineIcon from "@lucide/svelte/icons/combine";
  import type { WorldClimbingPoints, WorldDownloadStatus } from "@climbhub/climbing-data-gen";
  import {
    parseWorldClimbingPoints,
    WORLD_CLIMBING_QUERY,
  } from "@climbhub/climbing-data-gen/world-points";

  import EditMap from "./EditMap.svelte";
  import NodePanel from "./NodePanel.svelte";
  import TreeNode from "./TreeNode.svelte";
  import { EditorStore, type DataChanges, type EditorNode } from "./editor.svelte";
  import { downloadBlob, exportChangesZip, exportZip } from "./export";
  import { loadFromDisk, loadGitStatesFromDisk, saveToDisk } from "./data-source";
  import { loadFromGitHub, REPOSITORY, UPLOAD_MAX_FILES, UPLOAD_URL } from "./github";
  import { runRawOverpassQuery } from "./overpass";
  import type { BoundaryStates } from "./types";

  // With `vite dev`, data/ is read from and saved to the disk. On the deployed site, it is read
  // from GitHub, and the changes are downloaded as a zip or proposed as a pull request.
  const DEV = import.meta.env.DEV;

  let store = $state.raw<EditorStore>();
  let status = $state("Loading the boundaries…");
  let loadError = $state("");
  let timestamp = $state("");
  let map: ReturnType<typeof EditMap> | undefined = $state();
  let filter = $state("");
  const filterResult = $derived(store?.filterTree(filter));
  let refreshing = $state(false);
  let progress = $state<WorldDownloadStatus>();

  /** The server downloads the climbing places in the background: poll until they are ready. */
  async function getClimbing(resource: string): Promise<WorldClimbingPoints> {
    try {
      for (;;) {
        const res = await fetch(`${base}/api/edit-map/${resource}`);
        if (!res.ok) throw new Error(`${resource}: ${res.status} ${await res.text()}`);
        if (res.status !== 202) return await res.json();
        progress = await res.json();
        if (progress?.error)
          throw new Error(`Downloading the climbing places failed: ${progress.error}`);
        // A refresh only starts the download, then it is awaited like the first one
        resource = "climbing.json";
        await new Promise((r) => setTimeout(r, 5000));
      }
    } finally {
      progress = undefined;
    }
  }

  /** On the deployed site, the browser runs the query itself */
  async function queryClimbing(): Promise<WorldClimbingPoints> {
    return parseWorldClimbingPoints(await runRawOverpassQuery(WORLD_CLIMBING_QUERY));
  }

  async function load() {
    try {
      let files;
      let gitStates: BoundaryStates = {};
      if (DEV) {
        [files, gitStates] = await Promise.all([loadFromDisk(), loadGitStatesFromDisk()]);
      } else {
        status = `Loading the boundaries from GitHub (${REPOSITORY.owner}/${REPOSITORY.repo})…`;
        files = (
          await loadFromGitHub(
            (done, total) => (status = `Loading the boundaries from GitHub: ${done}/${total}`),
          )
        ).files;
      }
      let points: WorldClimbingPoints = { timestamp: "", points: [] };
      if (DEV) {
        status =
          "Loading the climbing places of the world (the first download takes a few minutes)…";
        points = await getClimbing("climbing.json");
      }
      timestamp = points.timestamp;
      status = "Geolocating…";
      // Let the status render before the heavy computation
      await new Promise((r) => setTimeout(r));
      store = new EditorStore(files, points.points);
      if (DEV) store.setGitStates(gitStates);
      store.selected = store.root;
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    }
  }
  load();

  async function refreshClimbing() {
    const message = timestamp
      ? "Download again the climbing places of the whole world? It takes a few minutes."
      : "Download the climbing places of the whole world from Overpass? It takes a few minutes.";
    if (!store || !confirm(message)) return;
    refreshing = true;
    try {
      const climbing = DEV ? await getClimbing("climbing-refresh.json") : await queryClimbing();
      timestamp = climbing.timestamp;
      store.setPoints(climbing.points);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      refreshing = false;
    }
  }

  function select(node: EditorNode) {
    if (!store) return;
    store.selected = node;
    map?.fitTo(node.bbox);
  }

  const stats = $derived.by(() => {
    if (!store) return;
    void store.version;
    return {
      total: store.points.length,
      unassigned: store.unassignedCount,
      ambiguous: store.ambiguousCount,
      modified: store.modifiedCount,
    };
  });

  let saving = $state(false);
  async function save() {
    if (!store) return;
    saving = true;
    try {
      const changes = store.changes();
      await saveToDisk(changes);
      store.markSaved(store.files());
      if (DEV) store.setGitStates(await loadGitStatesFromDisk());
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      saving = false;
    }
  }

  // --- Pull request ------------------------------------------------------------------------------

  let prOpen = $state(false);
  let prCopied = $state(false);
  const prChanges = $derived.by((): DataChanges | undefined => {
    if (!prOpen || !store) return;
    void store.version;
    return store.changes();
  });

  function togglePullRequest() {
    prOpen = !prOpen;
    prCopied = false;
  }

  /** What to paste as the description of the pull request */
  function prDescription({ write, delete: removed }: DataChanges) {
    return [
      "Made with the boundary editor (/edit-map).",
      "",
      ...[...write.keys()].map(
        (path) => `- ${path in store!.saved ? "Modified" : "Added"} \`${path}\``,
      ),
      ...(removed.length
        ? [
            "",
            "Files to delete (the upload page of GitHub cannot delete them):",
            ...removed.map((path) => `- \`${path}\``),
          ]
        : []),
    ].join("\n");
  }

  /** Downloads the changed files, copies the description, and opens the upload page of GitHub */
  async function pullRequest() {
    if (!prChanges) return;
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(
      exportChangesZip(prChanges) as BlobPart,
      `boundaries-${date}.zip`,
      "application/zip",
    );
    try {
      await navigator.clipboard.writeText(prDescription(prChanges));
      prCopied = true;
    } catch {
      prCopied = false;
    }
    window.open(UPLOAD_URL, "_blank", "noopener");
  }

  function download() {
    if (!store) return;
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(
      exportZip(store) as BlobPart,
      `reverse-geocoding-data-${date}.zip`,
      "application/zip",
    );
  }

  function undo() {
    try {
      store?.undo();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  function onkeydown(e: KeyboardEvent) {
    if (!store) return;
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, select")) return;
    if ((e.metaKey || e.ctrlKey) && e.key === "z") {
      e.preventDefault();
      undo();
    } else if (
      (e.key === "Delete" || e.key === "Backspace") &&
      store.selected &&
      store.vertexSelection.size
    ) {
      e.preventDefault();
      store.removeVertices(store.selected, [...store.vertexSelection.values()]);
      store.vertexSelection = new Map();
    } else if (e.key === "Escape" && store.vertexSelection.size) {
      store.vertexSelection = new Map();
    } else if (e.key === "Escape" && store.mergeSelection.size) {
      store.mergeSelection = new Set();
    } else if (e.key === "Escape" && store.mergeMode) {
      store.mergeMode = false;
    } else if (e.key === "Escape" && store.selected?.parent) {
      if (store.editing) store.editing = false;
      else select(store.selected.parent);
    } else if (e.key === "e" && store.selected?.boundary) {
      store.editing = !store.editing;
    } else if (e.key === "m" && !e.metaKey && !e.ctrlKey) {
      store.mergeMode = !store.mergeMode;
    }
  }

  $effect(() => {
    if (!stats?.modified) return;
    const beforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  });
</script>

<svelte:head>
  <title>{import.meta.env.DEV ? "[DEV] " : ""}Climbhub - Boundary editor</title>
</svelte:head>

<svelte:window {onkeydown} />

{#if loadError}
  <pre class="p-6 text-sm whitespace-pre-wrap text-destructive">{loadError}</pre>
{:else if !store}
  <div class="flex flex-col gap-1 p-6 text-sm">
    <p class="flex items-center gap-2"><LoaderIcon class="size-4 animate-spin" /> {status}</p>
    {#if progress}
      <p class="text-muted-foreground">
        Started at {new Date(progress.startedAt).toLocaleTimeString()}
      </p>
      {#if progress.retrying}<p class="text-amber-600">{progress.retrying}</p>{/if}
    {/if}
  </div>
{:else}
  <div class="flex h-dvh w-full overflow-hidden">
    <aside class="flex w-[26rem] shrink-0 flex-col border-r bg-sidebar">
      <header class="flex flex-col gap-2 border-b p-3">
        <div class="flex items-center gap-2">
          <h1 class="flex-1 font-semibold">Boundary editor</h1>
          <Button
            size="icon-sm"
            variant="outline"
            title="Undo (Ctrl+Z){store.undoStack.at(-1)
              ? `: ${store.undoStack.at(-1)?.label}`
              : ''}"
            disabled={!store.undoStack.length}
            onclick={undo}
          >
            <Undo2Icon />
          </Button>
          <Button
            size="sm"
            variant={store.mergeMode || store.mergeSelection.size > 0 ? "default" : "outline"}
            title="Toggle merge mode (M): select and merge multiple regions together"
            onclick={() => (store.mergeMode = !store.mergeMode)}
          >
            <CombineIcon class="size-3.5 mr-1" />
            Merge{store.mergeSelection.size ? ` (${store.mergeSelection.size})` : ""}
          </Button>
          {#if DEV}
            <Button
              size="sm"
              disabled={!stats?.modified || saving}
              onclick={save}
              title="Write the changes to packages/reverse-geocoding-data/data"
            >
              {#if saving}<LoaderIcon class="animate-spin" />{:else}<SaveIcon />{/if} Save
              {#if stats?.modified}<span class="rounded bg-primary-foreground/20 px-1 text-xs"
                  >{stats.modified}</span
                >{/if}
            </Button>
          {/if}
          <Button
            size="icon-sm"
            variant="outline"
            onclick={download}
            title="Download the whole packages/reverse-geocoding-data/data as a zip"
          >
            <DownloadIcon />
          </Button>
          <Button
            size="sm"
            variant={prOpen ? "default" : DEV ? "outline" : "default"}
            onclick={togglePullRequest}
            title="Propose the changes as a pull request on GitHub"
          >
            <GitPullRequestIcon /> PR
            {#if !DEV && stats?.modified}<span class="rounded bg-primary-foreground/20 px-1 text-xs"
                >{stats.modified}</span
              >{/if}
          </Button>
        </div>
        {#if prOpen && prChanges}
          {@const count = prChanges.write.size}
          <div class="flex flex-col gap-1.5 rounded-md border bg-background p-2 text-xs">
            {#if !count && !prChanges.delete.length}
              <p class="text-muted-foreground">No changes to propose.</p>
            {:else}
              <p class="text-muted-foreground">
                Proposes the changes to
                <a
                  class="underline"
                  href="https://github.com/{REPOSITORY.owner}/{REPOSITORY.repo}"
                  target="_blank">{REPOSITORY.owner}/{REPOSITORY.repo}</a
                >. Only a GitHub account is needed: GitHub makes the fork.
              </p>
              <ol class="list-decimal space-y-0.5 pl-4">
                <li>
                  Click below: the {count} changed file{count === 1 ? "" : "s"} download as a zip, and
                  GitHub opens.
                </li>
                <li>Unzip it, and drag its <code>data</code> folder onto the GitHub page.</li>
                <li>Click <b>Propose changes</b>, then <b>Create pull request</b>.</li>
                <li>Paste the description{prCopied ? " (copied)" : ""}.</li>
              </ol>
              {#if count > UPLOAD_MAX_FILES}
                <p class="text-rose-600">
                  GitHub takes at most {UPLOAD_MAX_FILES} files per upload: drop the folders of data/
                  one by one.
                </p>
              {/if}
              {#if prChanges.delete.length}
                <p class="text-amber-600">
                  {prChanges.delete.length} file{prChanges.delete.length === 1 ? " was" : "s were"} deleted
                  or renamed: the upload page cannot delete files, so they are listed in the description
                  for the maintainers.
                </p>
              {/if}
              <div class="flex items-center gap-2">
                <Button size="xs" onclick={pullRequest}
                  ><GitPullRequestIcon /> Create the pull request</Button
                >
                <Button
                  size="xs"
                  variant="ghost"
                  onclick={() =>
                    navigator.clipboard
                      .writeText(prDescription(prChanges!))
                      .then(() => (prCopied = true))}>Copy the description</Button
                >
              </div>
            {/if}
          </div>
        {/if}
        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <span class="flex-1">
            {stats?.total.toLocaleString()} places ·
            <span class:text-rose-600={stats?.unassigned}
              >{stats?.unassigned.toLocaleString()} dropped</span
            >
            ·
            <span class:text-amber-600={stats?.ambiguous}
              >{stats?.ambiguous.toLocaleString()} ambiguous</span
            >
          </span>
          <Button
            size="icon-xs"
            variant="ghost"
            title={progress
              ? `Downloading since ${new Date(progress.startedAt).toLocaleTimeString()}${progress.retrying ? `. ${progress.retrying}` : ""}`
              : timestamp
                ? `OSM data of ${timestamp}. Download again`
                : "Download the climbing places of the world"}
            disabled={refreshing}
            onclick={refreshClimbing}
          >
            <RefreshCwIcon class={refreshing ? "animate-spin" : ""} />
          </Button>
        </div>
        <div class="flex items-center gap-2">
          <input
            class="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
            placeholder="Filter regions"
            bind:value={filter}
          />
          <label
            class="flex shrink-0 items-center gap-1 text-xs"
            title="Highlight leaves with more places than this"
          >
            max
            <input
              class="w-16 rounded-md border border-input bg-background px-1 py-1 text-sm"
              type="number"
              min="1"
              bind:value={store.threshold}
            />
          </label>
        </div>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto p-1" role="tree">
        <TreeNode node={store.root} {store} {filter} {filterResult} onselect={select} />
      </div>

      {#if store.selected}
        <div class="max-h-[60%] min-h-0 overflow-y-auto border-t bg-background">
          {#key store.selected}
            <NodePanel
              {store}
              node={store.selected}
              canStage={DEV}
              getViewBBox={() => map!.getViewBBox()}
              fitTo={(b) => map?.fitTo(b)}
            />
          {/key}
        </div>
      {/if}
    </aside>

    <main class="min-w-0 flex-1">
      <EditMap bind:this={map} {store} />
    </main>
  </div>
{/if}
