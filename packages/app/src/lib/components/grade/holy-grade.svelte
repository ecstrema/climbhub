<script lang="ts">
  import { getGrade, type Grade } from "$lib/osm-tags";
  import type { Tags } from "osm-api";
  import { mode } from "mode-watcher";
  import { getPreferredRouteGradingScale } from "@/shell/providers/settings.svelte";
  import { allScalesMap, convertGrade } from "holy-grade";
  import { getColorFromGrade } from "./helpers";

  const {
    tags,
    grade,
    class: className = "",
  }: {
    grade?: Grade;
    tags?: Tags;
    class?: string;
  } = $props();

  const computedGrade: Grade = $derived(
    grade || (tags && getGrade(tags)) || { v: "no grade provided", scale: "unknown" },
  );

  const scale = $derived.by(() => {
    if (!computedGrade || computedGrade.scale === "unknown") return null;
    return allScalesMap[computedGrade.scale];
  });

  $effect(() => {
    if (computedGrade && computedGrade.scale === "unknown") {
      console.log("Unknown scale or grade for scale", scale, " and grade", computedGrade);
    }
  });

  const color = $derived.by(() => {
    if (!computedGrade || computedGrade.scale === "unknown") return null;

    return getColorFromGrade(computedGrade.v, computedGrade.scale, mode.current === "dark");
  });

  const preferredGradeScale = $derived.by(() => {
    return getPreferredRouteGradingScale().current;
  });

  const convertedGrade = $derived.by(() => {
    if (
      !computedGrade ||
      !scale ||
      computedGrade.scale === "unknown" ||
      !preferredGradeScale ||
      preferredGradeScale === "local" ||
      preferredGradeScale === computedGrade.scale
    )
      return null;

    return (
      convertGrade(
        computedGrade.v,
        allScalesMap[computedGrade.scale],
        allScalesMap[preferredGradeScale],
      ) ?? null
    );
  });
</script>

{#if computedGrade}
  <span class={className} style={`color: ${color || "currentColor"};`}>
    {#if convertedGrade}
      {convertedGrade}
    {:else}
      {computedGrade.v}
    {/if}
  </span>
{/if}
