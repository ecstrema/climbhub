<script lang="ts">
  let open = $state(false);
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

      <!-- Grade (Fill Color) -->
      <div class="mt-2.5">
        <div class="font-medium text-[11px] text-muted-foreground mb-1.5">Route Grade (Fill)</div>
        <div class="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
          <div class="flex items-center gap-1.5">
            <span class="size-2.5 rounded-full border border-black/20" style:background="hsl(120deg 80% 70%)"></span>
            <span>Easy</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="size-2.5 rounded-full border border-black/20" style:background="hsl(50deg 80% 70%)"></span>
            <span>Moderate</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="size-2.5 rounded-full border border-black/20" style:background="hsl(0deg 80% 70%)"></span>
            <span>Hard</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="size-2.5 rounded-full border border-black/20" style:background="hsl(280deg 80% 70%)"></span>
            <span>Pro</span>
          </div>
          <div class="flex items-center gap-1.5 col-span-2">
            <span class="size-2.5 rounded-full border border-black/20 bg-slate-400"></span>
            <span>Ungraded</span>
          </div>
        </div>
      </div>

      <!-- Type (Stroke Color) -->
      <div class="mt-2.5 pt-2 border-t border-border/60">
        <div class="font-medium text-[11px] text-muted-foreground mb-1.5">Route Type (Stroke)</div>
        <div class="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
          <div class="flex items-center gap-1.5">
            <span class="size-2.5 rounded-full bg-white border-2 border-blue-500"></span>
            <span>Sport</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="size-2.5 rounded-full bg-white border-2 border-purple-500"></span>
            <span>Boulder</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="size-2.5 rounded-full bg-white border-2 border-amber-500"></span>
            <span>Trad</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="size-2.5 rounded-full bg-white border-2 border-red-500"></span>
            <span>Aid</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="size-2.5 rounded-full bg-white border-2 border-cyan-500"></span>
            <span>Ice</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="size-2.5 rounded-full bg-white border-2 border-pink-500"></span>
            <span>Top rope</span>
          </div>
        </div>
      </div>

      <!-- Places & Features -->
      <div class="mt-2.5 pt-2 border-t border-border/60">
        <div class="font-medium text-[11px] text-muted-foreground mb-1.5">Places & Terrain</div>
        <div class="space-y-1 text-[11px]">
          <div class="flex items-center gap-1.5">
            <span class="size-2.5 rounded-full bg-[#78350f] border border-[#fde68a]"></span>
            <span>Cliff (from OSM)</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="size-2.5 rounded-full bg-orange-600 border border-white"></span>
            <span>Area / Crag</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="size-2.5 rounded-full bg-emerald-600 border border-white"></span>
            <span>Climbing Gym</span>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
