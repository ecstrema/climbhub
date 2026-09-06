<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { HTMLTextareaAttributes } from "svelte/elements";
  import { online } from "svelte/reactivity/window";

  let { value = $bindable(), class: className, ...props }: HTMLTextareaAttributes = $props();
</script>

<textarea
  class={cn(
    "bg-none border-none p-0 m-0 outline-none appearance-none focus:outline-accent-foreground field-sizing-content resize-none",
    className,
  )}
  bind:value
  disabled={!online.current}
  title={!online.current ? "You cannot edit when offline" : undefined}
  {...props}></textarea>
