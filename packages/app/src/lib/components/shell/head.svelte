<script lang="ts">
  import { getAppState } from "#lib/data/app-state.js";
  import { getLocalizedName } from "#lib/data/parse/localized-name.js";

  const isDev = import.meta.env.DEV;

  const appState = getAppState();

  const name: string | undefined = $derived(getLocalizedName(appState.currentNode.current?.feature));
</script>

<svelte:head>
  <title>{isDev ? "[DEV] " : ""}Climbhub{name ? ` - ${name}` : ""}</title>
</svelte:head>
