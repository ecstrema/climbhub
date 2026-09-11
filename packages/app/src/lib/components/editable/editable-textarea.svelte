<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { HTMLTextareaAttributes } from "svelte/elements";
  import EditableTooltip from "./editable-tooltip.svelte";
  import { osmUser } from "@/shell/providers";

  let { value = $bindable(), class: className, ...props }: HTMLTextareaAttributes = $props();
</script>

<EditableTooltip>
  {#snippet children(tooltipProps)}
    <textarea
      class={cn(
        "bg-none border-none p-0 m-0 outline-none appearance-none focus:outline-accent-foreground field-sizing-content resize-none self-start",
        className,
      )}
      bind:value
      disabled={!osmUser.loggedIn}
      {...tooltipProps}
      {...props}></textarea>
  {/snippet}
</EditableTooltip>
