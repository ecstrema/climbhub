<script lang="ts">
  import { getName } from "$lib/data";
  import { getCurrentNode } from "@/shell/providers";

  const name: string | undefined = $derived(getName(getCurrentNode().current.own));
</script>

<svelte:head>
  <title>Climbhub {name ? ` - ${name}` : ""}</title>
</svelte:head>
