<script lang="ts">
  import { resolve } from "$app/paths";
</script>

<h1>Climbhub</h1>

<a href={resolve("/world/[...slug]", { slug: "" })}>See all routes</a>

<!-- TODO: We need this else sveltekit complains that deep.json is never used. -->
<a class="hidden" href={resolve("/api/world/[...slug]/deep.json", { slug: "" })}> Download </a>
