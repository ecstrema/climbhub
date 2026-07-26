<script lang="ts">
  import { resolve } from "$app/paths";
</script>

<h1>Climbhub</h1>

<a href={resolve("/world/[...slug]", {slug: "north-america"})}>See all routes</a>
