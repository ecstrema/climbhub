<script lang="ts">
  import { getGrade, type Grade } from "$lib/osm-tags";
  import type { Tags } from "osm-api";
  import { mode } from "mode-watcher";
  import { getPreferredRouteGradingScale } from "@/shell/providers/settings.svelte";
  import { allScalesMap, convertGrade } from "@climbhub/holy-grade";
  import { getColorFromGrade } from "./helpers";

  const {
    tags,
    grade,
    convert = true,
    class: className = "",
  }: {
    grade?: Grade;
    tags?: Tags;
    class?: string;
    convert?: boolean;
  } = $props();

  const computedGrade: Grade = $derived(
    grade || (tags && getGrade(tags)?.v) || { v: "no grade provided", scale: "unknown" },
  );

  const scale = $derived.by(() => {
    if (!computedGrade || computedGrade.scale === "unknown") return;
    return allScalesMap[computedGrade.scale];
  });

  const color = $derived.by(() => {
    if (!computedGrade || computedGrade.scale === "unknown") return;

    return getColorFromGrade(computedGrade.v, computedGrade.scale, mode.current === "dark");
  });

  const preferredGradeScale = $derived.by(() => {
    return getPreferredRouteGradingScale().current;
  });

  const convertedGrade: string | undefined = $derived.by(() => {
    if (
      !computedGrade ||
      !scale ||
      computedGrade.scale === "unknown" ||
      !preferredGradeScale ||
      preferredGradeScale === "local" ||
      preferredGradeScale === computedGrade.scale
    )
      return;

    if (!convert) return computedGrade.v;

    return (
      convertGrade(
        computedGrade.v,
        allScalesMap[computedGrade.scale],
        allScalesMap[preferredGradeScale],
      ) ?? undefined
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
