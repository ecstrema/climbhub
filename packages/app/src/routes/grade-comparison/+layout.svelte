<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();

  const links = [
    {
      id: "route",
      label: "Route",
      href: resolve("grade-comparison/route"),
    },

    {
      id: "boulder",
      label: "Boulder",
      href: resolve("grade-comparison/boulder"),
    },

    {
      id: "ice",
      label: "Ice",
      href: resolve("grade-comparison/ice"),
    },

    {
      id: "aid",
      label: "Aid",
      href: resolve("grade-comparison/aid"),
    },

    {
      id: "danger",
      label: "Danger",
      href: resolve("grade-comparison/danger"),
    },
  ];
</script>

<div class="flex flex-col items-center justify-center gap-4 p-8 max-w-3xl mx-auto">
  <h1 class="prose dark:prose-invert">Grade Comparison</h1>
  <nav class="rounded-lg p-[3px] bg-muted inline-flex w-fit items-center justify-center text-muted-foreground">
    {#each links as link}
      {@const isActive = page.url.pathname.includes(`/grade-comparison/${link.id}`)}
      <a
        href={link.href}
        class="gap-1.5 rounded-md border border-transparent px-3 py-1.5 text-sm font-medium transition-all {isActive
          ? 'bg-background text-foreground shadow-sm dark:bg-input/30'
          : 'text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground'}"
      >
        {link.label}
      </a>
    {/each}
  </nav>

  <div class="w-full">
    {@render children()}
  </div>
</div>
