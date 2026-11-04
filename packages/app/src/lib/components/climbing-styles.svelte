<script lang="ts">
  import type { OsmFeature } from "osm-api";
  import { getClimbingStyles } from "#lib/data/parse/osm-tags.js";

  let { feature }: { feature: OsmFeature } = $props();
  const styles = $derived(feature.tags ? getClimbingStyles(feature.tags) : []);
</script>

{#if styles.length > 0}
  <ul class="flex flex-wrap gap-1.5" aria-label="Climbing styles">
    {#each styles as style (style.key)}
      <li class="inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-1 text-xs font-medium">
        {style.label}
        {#if style.count !== undefined}
          <span class="text-muted-foreground">{style.count} {style.count === 1 ? "route" : "routes"}</span>
        {/if}
      </li>
    {/each}
  </ul>
{/if}
