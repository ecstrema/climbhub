<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { HTMLInputAttributes } from "svelte/elements";

  let {
    value = $bindable(),
    class: className,
    ...props
  }: {
    class?: string;
  } & Omit<HTMLInputAttributes, "type"> = $props();
</script>

<input
  type="text"
  class={cn(
    "bg-none border-none p-0 m-0 outline-none appearance-none focus:outline-accent-foreground field-sizing-content",
    className,
  )}
  bind:value
  {...props}
/>
