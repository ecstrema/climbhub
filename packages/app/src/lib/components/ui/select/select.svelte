<script lang="ts">
  import type { HTMLSelectAttributes } from "svelte/elements";
  import { cn, type WithElementRef } from "#lib/utils.js";

  type Props = WithElementRef<HTMLSelectAttributes>;

  let {
    ref = $bindable(null),
    value = $bindable(),
    class: className,
    children,
    "data-slot": dataSlot = "select",
    ...restProps
  }: Props = $props();
</script>

<select
  bind:this={ref}
  data-slot={dataSlot}
  class={cn(
    "h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 transition-[color,box-shadow]",
    className,
  )}
  bind:value
  {...restProps}
>
  {@render children?.()}
</select>
