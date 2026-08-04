<script lang="ts">
  import type { Snippet } from "svelte";
  import { OSMUser, setOsmUser } from "./osm.svelte";

  export const user = new OSMUser();

  setOsmUser(user);

  const {
    children,
  }: {
    children: Snippet;
  } = $props();
</script>

{@render children?.()}
