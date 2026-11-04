<script lang="ts">
  import { getMapLinks } from "#lib/data/parse/gym-tags.js";
  import MapIcon from "@lucide/svelte/icons/map";

  let { coordinates, name }: { coordinates: { lat: number; lon: number }; name?: string } = $props();
  const links = $derived(getMapLinks(coordinates, name));
</script>

<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
  <MapIcon class="size-4 text-muted-foreground" aria-hidden="true" />
  <span class="text-muted-foreground">Open in</span>
  {#each links as link (link.id)}
    <a class="underline underline-offset-2" href={link.href}>{link.label}</a>
  {/each}
</div>
