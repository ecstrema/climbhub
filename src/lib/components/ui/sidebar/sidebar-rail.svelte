<script lang="ts">
  import { cn, type WithElementRef } from "$lib/utils.js";
  import type { HTMLAttributes } from "svelte/elements";
  import { useSidebar } from "./context.svelte.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> = $props();

  const sidebar = useSidebar();

  const clamp = (value: number, min: number, max: number) => {
    return Math.min(Math.max(value, min), max);
  };

  const startResize = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    if (sidebar.state === "collapsed") {
      sidebar.toggle();
      return;
    }

    event.preventDefault();

    const sidebarElement = ref?.closest('[data-slot="sidebar"]') as HTMLElement | null;
    if (!sidebarElement) {
      return;
    }

    const rootFontSize = Number.parseFloat(
      window.getComputedStyle(document.documentElement).fontSize,
    );
    const minWidth = 12 * rootFontSize;
    const maxWidth = Math.max(minWidth, 32 * rootFontSize);
    const side = sidebarElement.dataset.side === "right" ? "right" : "left";
    const startX = event.clientX;
    const startWidth = sidebarElement.getBoundingClientRect().width;

    const handleMove = (moveEvent: PointerEvent) => {
      const delta = side === "left" ? moveEvent.clientX - startX : startX - moveEvent.clientX;
      const nextWidth = clamp(startWidth + delta, minWidth, maxWidth);

      if (nextWidth <= minWidth) {
        sidebar.setOpen(false);
        return;
      } else {
        sidebar.setOpen(true);
      }

      sidebar.width.current = `${nextWidth}px`;
    };

    const handleEnd = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
  };
</script>

<div
  bind:this={ref}
  data-sidebar="rail"
  data-slot="sidebar-rail"
  role="separator"
  aria-orientation="vertical"
  aria-label="Resize Sidebar"
  onpointerdown={startResize}
  title="Resize Sidebar"
  class={cn(
    "hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 select-none transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 sm:flex",
    "in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
    "hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full",
    "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
    "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</div>
