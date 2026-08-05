<script lang="ts">
  import { getName } from "$lib/data";
  import { getCurrentNode } from "@/shell/providers";

  const currentNodeProvider = getCurrentNode();

  const name: string | null = $derived(getName(currentNodeProvider.current));
</script>

<svelte:head>
  <title>Climbhub {name ? ` - ${name}` : ""}</title>
</svelte:head>
