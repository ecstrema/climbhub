<script lang="ts">
  import { onMount } from "svelte";
  import { completeCommonsLogin } from "#lib/data/network/commons.js";

  let message = $state("Completing Wikimedia sign-in…");

  onMount(() => {
    void completeCommonsLogin(window.location.search)
      .then((returnTo) => window.location.replace(returnTo))
      .catch((error: unknown) => {
        message = error instanceof Error ? error.message : String(error);
      });
  });
</script>

<svelte:head>
  <title>Wikimedia sign-in | Climbhub</title>
</svelte:head>

<main class="mx-auto max-w-xl px-5 py-16 text-center">
  <h1 class="text-xl font-semibold">Wikimedia sign-in</h1>
  <p class="mt-3 text-sm text-muted-foreground" role="status">{message}</p>
</main>
