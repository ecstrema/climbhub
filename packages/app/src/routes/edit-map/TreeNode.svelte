<script lang="ts">
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import FolderIcon from "@lucide/svelte/icons/folder";
  import FileJsonIcon from "@lucide/svelte/icons/file-json";
  import CircleDashedIcon from "@lucide/svelte/icons/circle-dashed";
  import clsx from "clsx";
  import { BOUNDARY_STATE_COLORS } from "./types";
  import { LARGE_BOUNDARY_BYTES } from "@climbhub/reverse-geocoding-data/shared";

  import TreeNode from "./TreeNode.svelte";
  import { isPreciseCoast, hasFile, nodeName, type EditorNode, type EditorStore } from "./editor.svelte";

  const {
    node,
    store,
    depth = 0,
    filter = "",
    filterResult,
    onselect,
  }: {
    node: EditorNode;
    store: EditorStore;
    depth?: number;
    filter?: string;
    filterResult?: { visible: Set<number>; open: Set<number> };
    onselect: (node: EditorNode) => void;
  } = $props();

  let manuallyOpen = $state<boolean | undefined>();

  const info = $derived.by(() => {
    void store.version;
    return {
      name: nodeName(node),
      total: node.total,
      own: node.own,
      ambiguous: node.ambiguous,
      children: node.children,
      hasFile: hasFile(node),
      large: hasFile(node) && node.size > LARGE_BOUNDARY_BYTES,
      size: node.size,
      boundaryState: store.boundaryState(node),
      coast: store.coasts.get(node),
    };
  });

  const selected = $derived(store.selected === node);
  const toMerge = $derived(store.mergeSelection.has(node));
  const containsSelected = $derived(store.selectedAncestorIds.has(node.id));
  const open = $derived(
    manuallyOpen ?? (depth < 1 || containsSelected || (filterResult ? filterResult.open.has(node.id) : filter !== "")),
  );

  const visible = $derived(!filterResult ? true : filterResult.visible.has(node.id));

  const isLeaf = $derived(info.children.length === 0);
  const tooBig = $derived(isLeaf && info.total > store.threshold);

  /** Ctrl+click (⌘+click), Shift+click, or mergeMode picks a leaf to merge */
  function onclick(e: MouseEvent) {
    const isMultiSelect = e.ctrlKey || e.metaKey || e.shiftKey || store.mergeMode;
    if (isLeaf && !!node.parent && isMultiSelect) {
      store.toggleMerge(node);
    } else {
      onselect(node);
    }
  }

  function sourceTitle() {
    if (!isLeaf) return "Group of regions";
    if (info.hasFile) return `Leaf, ${Math.round(info.size / 1024)} KB`;
    return "No boundary: not saved";
  }

  let row: HTMLDivElement | undefined = $state();
  $effect(() => {
    if (selected) row?.scrollIntoView({ block: "nearest" });
  });
</script>

{#if visible}
  <div
    bind:this={row}
    role="treeitem"
    aria-selected={selected}
    tabindex="-1"
    class={clsx(
      "group flex h-7 cursor-pointer items-center gap-1 rounded-sm pr-2 text-sm hover:bg-muted",
      selected && "bg-accent font-medium ring-1 ring-ring/40",
      toMerge && "bg-rose-50 ring-1 ring-rose-400 dark:bg-rose-950",
    )}
    style:padding-left="{depth * 14 + 2}px"
    {onclick}
    onkeydown={(e) => e.key === "Enter" && onselect(node)}
  >
    <button
      class={clsx("rounded-sm p-0.5 hover:bg-background", isLeaf && "invisible")}
      aria-label={open ? "Collapse" : "Expand"}
      onclick={(e) => {
        e.stopPropagation();
        manuallyOpen = !open;
      }}
    >
      <ChevronRightIcon class={clsx("size-3.5 transition-transform", open && "rotate-90")} />
    </button>

    <span class="shrink-0 text-muted-foreground" title={sourceTitle()}>
      {#if !isLeaf}
        <FolderIcon class="size-3.5" />
      {:else if info.hasFile}
        <FileJsonIcon class="size-3.5" />
      {:else}
        <CircleDashedIcon class="size-3.5 text-rose-600" />
      {/if}
    </span>

    <span class="truncate">{info.name}</span>
    <span
      class="size-2 shrink-0 rounded-full"
      style:background-color={BOUNDARY_STATE_COLORS[info.boundaryState]}
      title={info.boundaryState}
      aria-label={info.boundaryState}
    ></span>
    <span class="ml-auto flex shrink-0 items-center gap-1 text-xs tabular-nums">
      {#if isPreciseCoast(node, info.coast)}
        <span
          class="text-sky-600"
          title="Precise coast: {Math.round(info.coast.length)} km with {(
            (info.coast.vertices / info.coast.length) *
            10
          ).toFixed(1)} points per 10 km. Nothing is in the sea: simplify it"
          >≈{((info.coast.vertices / info.coast.length) * 10).toFixed(0)}</span
        >
      {/if}
      {#if info.large}
        <span class="text-amber-600" title="Larger than {LARGE_BOUNDARY_BYTES / 1024} KB: simplify it">
          {Math.round(info.size / 1024)} KB
        </span>
      {/if}
      {#if info.ambiguous > 0}
        <span class="text-amber-600" title="Places inside overlapping regions">⚠{info.ambiguous}</span>
      {/if}
      {#if !isLeaf && info.own > 0}
        <span class="text-rose-600" title="Places in this region but not in any of its children">
          +{info.own}
        </span>
      {/if}
      <span
        class={clsx(
          "rounded px-1",
          tooBig ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100" : "text-muted-foreground",
          info.total === 0 && "opacity-40",
        )}
        title={tooBig ? `More than ${store.threshold} places: consider subdividing` : "Climbing places in this region"}
      >
        {info.total}
      </span>
    </span>
  </div>

  {#if open}
    {#each info.children as child (child.id)}
      <TreeNode node={child} {store} depth={depth + 1} {filter} {filterResult} {onselect} />
    {/each}
  {/if}
{/if}
