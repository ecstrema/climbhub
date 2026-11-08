<script lang="ts">
  import { mode } from "mode-watcher";
  import type { RouteScaleId } from "@climbhub/holy-grade";
  import { getPreferredRouteGradingScale } from "#components/shell/providers/settings.svelte.js";
  import { getColorFromGrade } from "#lib/data/network/grade.js";

  const DEFAULT_ROUTE_GRADES: Record<RouteScaleId, string[]> = {
    French: ["4a", "5a", "6a", "7a", "8a", "9a"],
    YDS: ["5.6", "5.8", "5.10a", "5.11a", "5.12a", "5.13a", "5.14a"],
    UIAA: ["IV", "V", "VI", "VII", "VIII", "IX", "X"],
    Ewbank: ["14", "16", "19", "22", "26", "29", "33"],
    Saxon: ["V", "VI", "VIIa", "VIIIa", "IXa", "Xa", "XIa"],
    Scandinavian: ["4", "5", "6-", "7-", "8-", "9-", "10-"],
    Polish: ["IV", "V", "VI+", "VI.2", "VI.4", "VI.6", "VI.7"],
    UKTech: ["4a", "4c", "5b", "6a", "6c", "7a", "7b"],
  };

  let {
    colorMode = $bindable("both"),
  }: {
    colorMode?: "grade" | "type" | "both";
  } = $props();

  let open = $state(false);

  const preferredScale = $derived.by(() => {
    try {
      const pref = getPreferredRouteGradingScale?.()?.current;
      if (pref && pref !== "local") return pref;
    } catch {}
    return "French" as RouteScaleId;
  });

  const gradeReferences = $derived(DEFAULT_ROUTE_GRADES[preferredScale] ?? DEFAULT_ROUTE_GRADES.French);
</script>

<div class="absolute bottom-6 left-3 z-10 max-w-[260px]">
  {#if !open}
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-md border border-border/80 bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur hover:bg-background transition-colors"
      onclick={() => (open = true)}
      aria-label="Show map legend"
    >
      <span class="inline-block size-2.5 rounded-full bg-blue-500"></span>
      Legend
    </button>
  {:else}
    <div
      class="rounded-lg border border-border/80 bg-background/95 p-3 text-xs text-foreground shadow-md backdrop-blur max-h-72 overflow-y-auto"
    >
      <div class="flex items-center justify-between pb-2 border-b border-border/60">
        <span class="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Map Legend</span>
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground text-xs font-bold px-1"
          onclick={() => (open = false)}
          aria-label="Close legend"
        >
          ✕
        </button>
      </div>

      <!-- Mode Selector -->
      <div class="mt-2 flex items-center justify-between gap-2 pb-2 border-b border-border/40">
        <label for="legend-mode" class="text-[11px] font-medium text-muted-foreground">Color by</label>
        <select
          id="legend-mode"
          bind:value={colorMode}
          class="rounded border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="both">Both</option>
          <option value="grade">Grade</option>
          <option value="type">Type</option>
        </select>
      </div>

      <!-- Grade -->
      {#if colorMode === "grade" || colorMode === "both"}
        <div class="mt-2.5">
          <div class="font-medium text-[11px] text-muted-foreground mb-1.5 flex justify-between items-center">
            <span>{colorMode === "both" ? "Grade (fill)" : "Grade"}</span>
            <span class="text-[10px] opacity-70">({preferredScale})</span>
          </div>
          <div class="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
            {#each gradeReferences as g (g)}
              <div class="flex items-center gap-1.5">
                <span
                  class="size-2.5 rounded-full border border-black/20"
                  style:background={getColorFromGrade(g, preferredScale, mode.current === "dark")}
                ></span>
                <span>{g}</span>
              </div>
            {/each}
            <div class="flex items-center gap-1.5 col-span-2">
              <span class="size-2.5 rounded-full border border-black/20 bg-slate-400"></span>
              <span>Ungraded</span>
            </div>
          </div>
        </div>
      {/if}

      <!-- Type -->
      {#if colorMode === "type" || colorMode === "both"}
        <div class="mt-2.5 pt-2 border-t border-border/60">
          <div class="font-medium text-[11px] text-muted-foreground mb-1.5">
            {colorMode === "both" ? "Type (stroke)" : "Type"}
          </div>
          <div class="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
            <div class="flex items-center gap-1.5">
              {#if colorMode === "both"}
                <span class="size-2.5 rounded-full bg-white border-2 border-blue-500"></span>
              {:else}
                <span class="size-2.5 rounded-full bg-blue-500"></span>
              {/if}
              <span>Sport</span>
            </div>
            <div class="flex items-center gap-1.5">
              {#if colorMode === "both"}
                <span class="size-2.5 rounded-full bg-white border-2 border-purple-500"></span>
              {:else}
                <span class="size-2.5 rounded-full bg-purple-500"></span>
              {/if}
              <span>Boulder</span>
            </div>
            <div class="flex items-center gap-1.5">
              {#if colorMode === "both"}
                <span class="size-2.5 rounded-full bg-white border-2 border-amber-500"></span>
              {:else}
                <span class="size-2.5 rounded-full bg-amber-500"></span>
              {/if}
              <span>Trad</span>
            </div>
            <div class="flex items-center gap-1.5">
              {#if colorMode === "both"}
                <span class="size-2.5 rounded-full bg-white border-2 border-red-500"></span>
              {:else}
                <span class="size-2.5 rounded-full bg-red-500"></span>
              {/if}
              <span>Aid</span>
            </div>
            <div class="flex items-center gap-1.5">
              {#if colorMode === "both"}
                <span class="size-2.5 rounded-full bg-white border-2 border-cyan-500"></span>
              {:else}
                <span class="size-2.5 rounded-full bg-cyan-500"></span>
              {/if}
              <span>Ice</span>
            </div>
            <div class="flex items-center gap-1.5">
              {#if colorMode === "both"}
                <span class="size-2.5 rounded-full bg-white border-2 border-pink-500"></span>
              {:else}
                <span class="size-2.5 rounded-full bg-pink-500"></span>
              {/if}
              <span>Top rope</span>
            </div>
            <div class="flex items-center gap-1.5 col-span-2">
              {#if colorMode === "both"}
                <span class="size-2.5 rounded-full bg-white border-2 border-emerald-600"></span>
              {:else}
                <span class="size-2.5 rounded-full bg-emerald-600"></span>
              {/if}
              <span>Gym</span>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
