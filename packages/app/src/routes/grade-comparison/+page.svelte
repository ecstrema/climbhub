<script lang="ts">
  import { resolve } from "$app/paths";
</script>

<svelte:head>
  <meta http-equiv="refresh" content="0;url={resolve('grade-comparison/route')}" />
</svelte:head>

<p class="text-center text-muted-foreground">
  Redirecting to

  <a href={resolve("grade-comparison/route")} class="underline">Route Grade Comparison</a>

  ...
</p>
