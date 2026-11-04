<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { osmIndexFile, parseOsmPathSegment } from "@climbhub/common";
  import { resolve } from "$app/paths";
  import { Button } from "#components/ui/button/index.js";
  import { dataClient } from "#lib/data/network/data-client.js";
  import { getLocalizedName } from "#lib/data/parse/localized-name.js";
  import { getParentSlug } from "#lib/helpers/slug.js";
  import type { DataJSON } from "@climbhub/climbing-data-gen";

  const slug = $derived(page.params.slug ?? "");
  let nearest = $state<{ slug: string; feature: DataJSON } | undefined>();
  let searching = $state(true);

  /** Current slug of the OSM feature referenced by the last segment of the slug, if it still exists. */
  async function findByOsmId(candidate: string): Promise<string | undefined> {
    const osm = parseOsmPathSegment(candidate.split("/").at(-1) ?? "");
    if (!osm) return undefined;
    const res = await fetch(`${resolve("/").replace(/\/$/, "")}/api/${osmIndexFile(osm.type, osm.id)}`);
    if (!res.ok) return undefined;
    const index: Record<string, string> = await res.json();
    return index[osm.id];
  }

  // The page itself may have moved: its OSM id is found again. Otherwise walks up until a page exists.
  onMount(async () => {
    let candidate: string | undefined = slug;
    while (candidate !== undefined) {
      const movedTo = await findByOsmId(candidate);
      if (movedTo !== undefined && (await dataClient.getNode(movedTo))) {
        if (candidate === slug) {
          await goto(resolve("/world/[...slug]", { slug: movedTo }), { replaceState: true });
          return;
        }
        nearest = { slug: movedTo, feature: (await dataClient.getNode(movedTo))! };
        break;
      }
      candidate = getParentSlug(candidate);
      const feature = candidate === undefined ? undefined : await dataClient.getNode(candidate);
      if (candidate !== undefined && feature) {
        nearest = { slug: candidate, feature };
        break;
      }
    }
    searching = false;
  });
</script>

<svelte:head>
  <title>Page not found | Climbhub</title>
</svelte:head>

<div class="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-6">
  <h1 class="text-2xl font-semibold">
    {page.status === 404 ? "This page doesn't exist anymore" : "Something went wrong"}
  </h1>
  {#if page.status === 404}
    <p class="text-muted-foreground">
      <code class="break-all">/{slug}</code> could not be found. It may have been moved, renamed or removed.
    </p>
    {#if nearest}
      <p>
        The closest page that still exists is
        <a class="underline underline-offset-2" href={resolve("/world/[...slug]", { slug: nearest.slug })}>
          {nearest.slug === "" ? "the world" : (getLocalizedName(nearest.feature) ?? nearest.slug)}
        </a>.
      </p>
    {/if}
  {:else}
    <p class="text-muted-foreground">{page.error?.message}</p>
  {/if}
  {#if !searching || page.status !== 404}
    <div>
      <Button href={resolve("/world/[...slug]", { slug: nearest?.slug ?? "" })}>
        {nearest ? "Go to the closest page" : "Go to the world"}
      </Button>
    </div>
  {/if}
</div>
