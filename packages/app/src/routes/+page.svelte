<script lang="ts">
  import { resolve } from "$app/paths";

  const regions = [
    { name: "Africa", slug: "africa" },
    { name: "Americas", slug: "americas" },
    { name: "Asia", slug: "asia" },
    { name: "Europe", slug: "europe" },
    { name: "Oceania", slug: "oceania" },
  ];
</script>

<svelte:head>
  <title>Climbhub</title>
  <meta
    name="description"
    content="Explore climbing routes and areas by region."
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
          All routes
        </a>
        <a
          href={resolve("/settings")}
          class="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Settings
        </a>
      </nav>
    </div>
  </header>

  <main class="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
    <section class="mb-8 max-w-2xl">
      <h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">Explore routes</h1>
      <p class="mt-2 text-sm text-muted-foreground">Browse climbing areas by region.</p>
    </section>

    <section aria-label="Regions" class="max-w-2xl">
      <ul class="divide-y border-y">
        {#each regions as region (region.slug)}
          <li>
            <a
              href={resolve("/world/[...slug]", { slug: region.slug })}
              class="flex min-h-12 items-center justify-between py-2 text-sm font-medium hover:text-primary"
            >
              {region.name}
            </a>
          </li>
        {/each}
      </ul>
    </section>
  </main>
</div>
