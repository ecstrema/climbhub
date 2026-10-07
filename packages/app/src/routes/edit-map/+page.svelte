<script lang="ts">
  import { base } from "$app/paths";
  import { Button } from "@/ui/button";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import Undo2Icon from "@lucide/svelte/icons/undo-2";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import LoaderIcon from "@lucide/svelte/icons/loader-circle";
  import type { WorldClimbingPoints, WorldDownloadStatus } from "@climbhub/climbing-data-gen";

  import EditMap from "./EditMap.svelte";
  import NodePanel from "./NodePanel.svelte";
  import TreeNode from "./TreeNode.svelte";
  import { EditorStore, type EditorNode } from "./editor.svelte";
  import { downloadBlob, exportZip } from "./export";
  import type { ServerTreeNode } from "./types";

  let store = $state.raw<EditorStore>();
  let status = $state("Loading the boundaries…");
  let loadError = $state("");
  let timestamp = $state("");
  let map: ReturnType<typeof EditMap> | undefined = $state();
  let filter = $state("");
  let refreshing = $state(false);
  let progress = $state<WorldDownloadStatus>();

  async function getJSON<T>(resource: string): Promise<T> {
    const res = await fetch(`${base}/api/edit-map/${resource}`);
    if (!res.ok) throw new Error(`${resource}: ${res.status} ${await res.text()}`);
    return res.json();
  }

  /** The server downloads the climbing places in the background: poll until they are ready. */
  async function getClimbing(resource: string): Promise<WorldClimbingPoints> {
    try {
      for (;;) {
        const res = await fetch(`${base}/api/edit-map/${resource}`);
        if (!res.ok) throw new Error(`${resource}: ${res.status} ${await res.text()}`);
        if (res.status !== 202) return await res.json();
        progress = await res.json();
        if (progress?.error) throw new Error(`Downloading the climbing places failed: ${progress.error}`);
        // A refresh only starts the download, then it is awaited like the first one
        resource = "climbing.json";
        await new Promise((r) => setTimeout(r, 5000));
      }
    } finally {
      progress = undefined;
    }
  }

  async function load() {
    try {
      const tree = await getJSON<ServerTreeNode>("tree.json");
      status = "Loading the climbing places of the world (the first download takes a few minutes)…";
      const climbing = await getClimbing("climbing.json");
      timestamp = climbing.timestamp;
      status = "Geolocating…";
      // Let the status render before the heavy computation
      await new Promise((r) => setTimeout(r));
      store = new EditorStore(tree, climbing.points);
      store.selected = store.root;
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    }
  }
  load();

  async function refreshClimbing() {
    if (!store || !confirm("Download again the climbing places of the whole world? It takes a few minutes.")) return;
    refreshing = true;
    try {
      const climbing = await getClimbing("climbing-refresh.json");
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
      modified: store.modifiedNodes.length + store.removedPaths.size,
    };
  });

  function download() {
    if (!store) return;
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(exportZip(store) as BlobPart, `reverse-geocoding-data-${date}.zip`, "application/zip");
  }

  function onkeydown(e: KeyboardEvent) {
    if (!store) return;
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, select")) return;
    if ((e.metaKey || e.ctrlKey) && e.key === "z") {
      e.preventDefault();
      store.undo();
    } else if (e.key === "Escape" && store.selected?.parent) {
      if (store.editing) store.editing = false;
      else select(store.selected.parent);
    } else if (e.key === "e" && store.selected?.boundary) {
      store.editing = !store.editing;
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

{#if !import.meta.env.DEV}
  <p class="p-6">The boundary editor is only available with <code>bun run dev</code>.</p>
{:else if loadError}
  <pre class="p-6 text-sm whitespace-pre-wrap text-destructive">{loadError}</pre>
{:else if !store}
  <div class="flex flex-col gap-1 p-6 text-sm">
    <p class="flex items-center gap-2"><LoaderIcon class="size-4 animate-spin" /> {status}</p>
    {#if progress}
      <p class="text-muted-foreground">Started at {new Date(progress.startedAt).toLocaleTimeString()}</p>
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
            title="Undo (Ctrl+Z){store.undoStack.at(-1) ? `: ${store.undoStack.at(-1)?.label}` : ''}"
            disabled={!store.undoStack.length}
            onclick={() => store?.undo()}
          >
            <Undo2Icon />
          </Button>
          <Button size="sm" onclick={download} title="Zip of packages/reverse-geocoding-data/data">
            <DownloadIcon /> data.zip
            {#if stats?.modified}<span class="rounded bg-primary-foreground/20 px-1 text-xs">{stats.modified}</span>{/if}
          </Button>
        </div>
        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <span class="flex-1">
            {stats?.total.toLocaleString()} places ·
            <span class:text-rose-600={stats?.unassigned}>{stats?.unassigned.toLocaleString()} dropped</span> ·
            <span class:text-amber-600={stats?.ambiguous}>{stats?.ambiguous.toLocaleString()} ambiguous</span>
          </span>
          <Button
            size="icon-xs"
            variant="ghost"
            title={progress
              ? `Downloading since ${new Date(progress.startedAt).toLocaleTimeString()}${progress.retrying ? `. ${progress.retrying}` : ""}`
              : `OSM data of ${timestamp}. Download again`}
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
          <label class="flex shrink-0 items-center gap-1 text-xs" title="Highlight leaves with more places than this">
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
        <TreeNode node={store.root} {store} {filter} onselect={select} />
      </div>

      {#if store.selected}
        <div class="max-h-[60%] min-h-0 overflow-y-auto border-t bg-background">
          {#key store.selected}
            <NodePanel
              {store}
              node={store.selected}
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
