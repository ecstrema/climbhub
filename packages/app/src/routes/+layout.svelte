<script lang="ts">
  import { navigating, updated } from "$app/state";
  import { localDb } from "#lib/data/db/local-db.svelte.js";
  import { Button } from "#components/ui/button/index.js";

  const downloading = $derived(localDb.status === "downloading");
  const downloadPercent = $derived(localDb.total ? Math.min(100, (localDb.loaded / localDb.total) * 100) : undefined);

  // Sveltekit checks for updates on navigation. We need this for idle pages.
  $effect(() => {
    const interval = setInterval(
      async () => {
        if (await updated.check()) {
          console.log("New version found");
        }
      },
      15 * 60 * 1000,
    ); // 15 minutes

    return () => clearInterval(interval);
  });

  let dismissed = $state(false);

  import "./layout.css";

  import { ModeWatcher } from "mode-watcher";
  const { children } = $props();
</script>

<ModeWatcher />

{#if downloading && downloadPercent !== undefined}
  <div class="fixed top-0 inset-x-0 h-0.5 z-50 bg-primary/20" role="progressbar" aria-label="Downloading data">
    <div class="h-full bg-primary transition-[width]" style:width="{downloadPercent}%"></div>
  </div>
{:else if downloading || navigating.to}
  <div class="fixed top-0 inset-x-0 h-0.5 z-50 overflow-hidden bg-primary/20" role="progressbar" aria-label="Loading">
    <div class="loader-bar h-full w-1/3 bg-primary"></div>
  </div>
{/if}

{@render children()}

{#if updated.current && !dismissed}
  <!-- Sonner with buttons to reload the page -->
  <div
    class="fixed bottom-5 right-5 p-4 rounded-2xl flex gap-3 items-center z-10 bg-popover text-popover-foreground shadow"
  >
    <p>A new version of Climbhub is available</p>
    <div>
      <Button onclick={() => window.location.reload()}>Update</Button>
      <Button onclick={() => (dismissed = true)} variant="outline">Dismiss</Button>
    </div>
  </div>
{/if}

<style>
  .loader-bar {
    animation: loader-slide 1.1s ease-in-out infinite;
  }
  @keyframes loader-slide {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(300%);
    }
  }
</style>
