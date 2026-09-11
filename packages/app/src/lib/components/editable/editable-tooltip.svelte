<script lang="ts">
  import { osmUser } from "@/shell/providers";
  import type { Snippet } from "svelte";
  import * as Tooltip from "@/ui/tooltip";
  import { Button } from "@/ui/button";

  const {
    children,
  }: {
    children: Snippet<[any]>;
  } = $props();
</script>

{#if osmUser.loggedIn}
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
        <Button variant="outline" class="cursor-pointer" onclick={() => osmUser.login()}>
          Log in with OSM
        </Button>
        to edit
      </p>
    </Tooltip.Content>
  </Tooltip.Root>
{/if}
