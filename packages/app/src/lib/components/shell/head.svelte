<script lang="ts">
  import { getAppState } from "$lib/data/app-state";
  import { getName } from "$lib/data/parse/data";

  const isDev = import.meta.env.DEV;

  const appState = getAppState();

  const name: string | undefined = $derived(getName(appState.currentNode.current?.feature));
</script>

<svelte:head>
  <title>{isDev ? "[DEV] " : ""}Climbhub{name ? ` - ${name}` : ""}</title>
</svelte:head>
