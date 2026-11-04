<script lang="ts">
  import type { Snippet } from "svelte";
  import * as Tooltip from "#components/ui/tooltip/index.js";
  import { Button } from "#components/ui/button/index.js";
  import { getAppState } from "#lib/data/app-state.js";

  const {
    children,
  }: {
    children: Snippet<[any]>;
  } = $props();

  const appState = getAppState();
</script>

{#if appState.osmUser.loggedIn}
  {@render children({})}
{:else}
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        {@render children(props)}
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content>
      <p class="text-sm">
        <Button variant="outline" class="cursor-pointer" onclick={() => appState.osmUser.login()}>
          Log in with OSM
        </Button>
        to edit
      </p>
    </Tooltip.Content>
  </Tooltip.Root>
{/if}
