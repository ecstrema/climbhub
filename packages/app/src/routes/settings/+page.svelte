<script lang="ts">
  import { onMount } from "svelte";
  import { isLoggedIn } from "osm-api";
  import { resolve } from "$app/paths";
  import { Button } from "#components/ui/button/index.js";
  import { loginOsm, logoutOsm } from "#lib/data/network/osm.svelte.js";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import { allBoulderScales, allRouteScales, convertGrade, french } from "@climbhub/holy-grade";
  import { setMode, userPrefersMode } from "mode-watcher";
  import { settings } from "#lib/data/settings.svelte.js";
  import {
    getPreferredBoulderGradingScale,
    getPreferredRouteGradingScale,
  } from "#lib/components/shell/providers/settings.svelte.js";

  const preferredRouteScale = getPreferredRouteGradingScale();
  const preferredBoulderScale = getPreferredBoulderGradingScale();
  const routeScale = $derived(allRouteScales.find((scale) => scale.id === preferredRouteScale.current));
  const boulderScale = $derived(allBoulderScales.find((scale) => scale.id === preferredBoulderScale.current));
  const routeExamples = $derived(
    routeScale ? ["6a", "7a", "8a"].map((grade) => convertGrade(grade, french, routeScale)).join(", ") : "",
  );
  const boulderExamples = $derived(
    boulderScale ? ["5A", "6A", "7A"].map((grade) => convertGrade(grade, french, boulderScale)).join(", ") : "",
  );

  let osmLoggedIn = $state<boolean | undefined>(undefined);
  let hasPreviousPage = $state(false);

  onMount(() => {
    osmLoggedIn = isLoggedIn();
    hasPreviousPage = window.history.length > 1;
  });

  function toggleOsmLogin() {
    if (osmLoggedIn) {
      logoutOsm();
      osmLoggedIn = isLoggedIn();
    } else {
      loginOsm(() => {
        osmLoggedIn = isLoggedIn();
      });
    }
  }
</script>

<svelte:head>
  <title>Settings | Climbhub</title>
</svelte:head>

<div class="min-h-screen bg-background text-foreground">
  <header class="border-b">
    <div class="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
      <a href={resolve("/")} class="font-semibold tracking-tight">Climbhub</a>
      {#if hasPreviousPage}
        <Button variant="ghost" onclick={() => window.history.back()}>
          <ArrowLeftIcon />
          Back
        </Button>
      {:else}
        <a href={resolve("world")} class="text-sm text-muted-foreground transition-colors hover:text-foreground">
          Browse climbs
        </a>
      {/if}
    </div>
  </header>

  <main class="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
    <div class="mb-8 border-l-4 border-primary pl-5">
      <p class="text-xs font-semibold uppercase text-muted-foreground">Preferences</p>
      <h1 class="mt-1 text-3xl font-semibold tracking-tight">Settings</h1>
    </div>

    <section class="grid gap-4 border-t py-6 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] sm:items-center">
      <div>
        <h2 class="font-medium">Appearance</h2>
        <p class="mt-1 text-sm text-muted-foreground">Theme</p>
      </div>
      <select
        aria-label="Theme"
        class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        bind:value={() => userPrefersMode.current, setMode}
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </section>

    <section class="grid gap-4 border-t py-6 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] sm:items-start">
      <div>
        <h2 class="font-medium">Route grading scale</h2>
        <p class="mt-1 text-sm text-muted-foreground">Choose how route grades are displayed.</p>
      </div>
      <div class="space-y-2">
        <select
          aria-label="Route grading scale"
          class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          bind:value={preferredRouteScale.current}
        >
          <option value="local">Local to each area</option>
          {#each allRouteScales as scale (scale.id)}
            <option value={scale.id}>{scale.name} ({scale.id})</option>
          {/each}
        </select>
        <p class="text-sm text-muted-foreground">
          {routeScale?.description ?? "Uses the grading scale set for each area."}
          {#if routeExamples}
            <span class="mt-1 block"><span class="font-medium text-foreground">Examples:</span> {routeExamples}</span>
          {/if}
        </p>
      </div>
    </section>

    <section class="grid gap-4 border-t py-6 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] sm:items-start">
      <div>
        <h2 class="font-medium">Boulder grading scale</h2>
        <p class="mt-1 text-sm text-muted-foreground">Choose how boulder grades are displayed.</p>
      </div>
      <div class="space-y-2">
        <select
          aria-label="Boulder grading scale"
          class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          bind:value={preferredBoulderScale.current}
        >
          <option value="local">Local to each area</option>
          {#each allBoulderScales as scale (scale.id)}
            <option value={scale.id}>{scale.name} ({scale.id})</option>
          {/each}
        </select>
        <p class="text-sm text-muted-foreground">
          {boulderScale?.description ?? "Uses the grading scale set for each area."}
          {#if boulderExamples}
            <span class="mt-1 block"><span class="font-medium text-foreground">Examples:</span> {boulderExamples}</span>
          {/if}
        </p>
      </div>
    </section>

    <section class="grid gap-4 border-y py-6 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] sm:items-center">
      <div>
        <h2 class="font-medium">Data usage</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          When enabled, Climbhub does not automatically download the full climbing dataset. Areas load as you visit
          them, so search may only include areas you have already opened. You can still download all data from the
          sidebar when you need complete search coverage.
        </p>
      </div>
      <label class="flex min-h-10 items-center gap-3 text-sm">
        <input type="checkbox" class="size-4 accent-primary" bind:checked={settings.lowData} />
        Low data usage
      </label>
    </section>

    <section class="grid gap-4 border-b py-6 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] sm:items-center">
      <div>
        <h2 class="font-medium">OpenStreetMap account</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Sign in to edit climbing data and submit your changes to OpenStreetMap.
        </p>
      </div>
      <Button onclick={toggleOsmLogin} disabled={osmLoggedIn === undefined} variant="outline">
        {#if osmLoggedIn === undefined}
          Checking login status...
        {:else if osmLoggedIn}
          Log out of OpenStreetMap
        {:else}
          Log in with OpenStreetMap
        {/if}
      </Button>
    </section>
  </main>
</div>
