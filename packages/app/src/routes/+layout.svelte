<script lang="ts">
  import { updated } from "$app/state";
  import { Button } from "@/ui/button";

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
</style>
