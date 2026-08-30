<script lang="ts">
  import { resolve } from "$app/paths";
</script>

<svelte:head>
  <title>Climbhub</title>
</svelte:head>

<h1>Climbhub</h1>

<a href={resolve("/world/[...slug]", { slug: "" })}>See all routes</a>
