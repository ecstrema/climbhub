<script lang="ts">
  import { resolve } from "$app/paths";
  import ArrowUpRightIcon from "@lucide/svelte/icons/arrow-up-right";

  const regions = [
    { name: "Africa", note: "Areas and routes across the continent", slug: "africa" },
    { name: "Americas", note: "From local crags to big walls", slug: "americas" },
    { name: "Asia", note: "Find climbing areas across Asia", slug: "asia" },
    { name: "Europe", note: "Explore established and new areas", slug: "europe" },
    { name: "Oceania", note: "Browse climbing around the Pacific", slug: "oceania" },
  ];
</script>

<svelte:head>
  <title>Climbhub</title>
  <meta
    name="description"
    content="Explore climbing areas and routes around the world, and compare grades across climbing styles."
  />
</svelte:head>

<div class="min-h-screen bg-background text-foreground">
  <header class="border-b">
    <div class="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
      <a href={resolve("/")} class="font-semibold tracking-tight">Climbhub</a>
      <nav aria-label="Main navigation" class="flex items-center gap-4">
        <a
          href={resolve("/world/[...slug]", { slug: "" })}
          class="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          World map
        </a>
        <a
          href={resolve("/grade-comparison/route")}
          class="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Grade comparison
        </a>
      </nav>
    </div>
  </header>

  <main class="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
    <section class="mb-9 max-w-2xl">
      <p class="text-sm text-muted-foreground">Climbing areas, routes, and grades</p>
      <h1 class="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Climbing starts here.</h1>
      <p class="mt-3 text-base leading-7 text-muted-foreground">
        Browse places to climb, explore route details, and compare the grading systems you know.
      </p>
    </section>

    <section aria-label="Explore Climbhub" class="grid gap-4 md:grid-cols-2">
      <div class="rounded-md border bg-card p-5 text-card-foreground">
        <div class="flex items-baseline justify-between gap-3">
          <h2 class="text-lg font-semibold">Explore by region</h2>
          <a
            href={resolve("/world/[...slug]", { slug: "" })}
            class="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            Full map <ArrowUpRightIcon size={15} />
          </a>
        </div>
        <p class="mt-1 text-sm text-muted-foreground">Start with a continent, then browse areas and routes.</p>
        <ul class="mt-4 divide-y border-t">
          {#each regions as region (region.slug)}
            <li>
              <a
                href={resolve("/world/[...slug]", { slug: region.slug })}
                class="flex min-h-12 items-center justify-between gap-4 py-2 transition-colors hover:text-primary"
              >
                <span class="text-sm font-medium">{region.name}</span>
                <span class="text-right text-xs text-muted-foreground">{region.note}</span>
              </a>
            </li>
          {/each}
        </ul>
      </div>

      <div class="rounded-md border bg-card p-5 text-card-foreground">
        <h2 class="text-lg font-semibold">Grade comparison</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          See how route, boulder, ice, and aid grades relate across scales.
        </p>
        <div class="mt-5 flex items-center gap-2 text-sm" aria-label="Example grades: 5a, 5.9, and V2">
          <span class="rounded-sm border bg-background px-3 py-2">5a</span>
          <span class="text-muted-foreground">/</span>
          <span class="rounded-sm border bg-background px-3 py-2">5.9</span>
          <span class="text-muted-foreground">/</span>
          <span class="rounded-sm border bg-background px-3 py-2">V2</span>
        </div>
        <a
          href={resolve("/grade-comparison/route")}
          class="mt-5 inline-flex items-center gap-2 border-t pt-4 text-sm font-medium hover:text-primary"
        >
          Compare route grades <ArrowUpRightIcon size={16} />
        </a>
      </div>
    </section>
  </main>
</div>