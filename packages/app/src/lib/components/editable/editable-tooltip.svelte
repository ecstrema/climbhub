<script lang="ts">
  import { osmUser } from "@/shell/providers";
  import type { Snippet } from "svelte";
  import * as Tooltip from "@/ui/tooltip";
  import { Button } from "@/ui/button";

  const {
    children,
  }: {
    children: Snippet;
  } = $props();
</script>

{#if osmUser.loggedIn}
  {@render children()}
{:else}
  <Tooltip.Root>
    <Tooltip.Trigger>
      <div class="flex gap-2 items-baseline">
        {@render children()}
      </div>
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
