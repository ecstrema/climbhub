<script lang="ts">
  import { getAppState } from "$lib/data/app-state";
  import { getName } from "$lib/data/parse/data";

  const appState = getAppState();

  const name: string | undefined = $derived(getName(appState.currentNode.current?.feature));
</script>

<svelte:head>
  <title>Climbhub{name ? ` - ${name}` : ""}</title>
</svelte:head>
