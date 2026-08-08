<script lang="ts">
  import { getGrade } from "$lib/osm-tags";
  import type { Tags } from "osm-api";
  import { mode } from "mode-watcher";
  import { getPreferredRouteGradingScale } from "@/shell/providers/settings.svelte";
  import { allScalesMap, convertGrade } from "holy-grade";
  import { getColorFromGrade } from "./helpers";

  const {
    tags,
    class: className = "",
  }: {
    tags: Tags;
    class?: string;
  } = $props();

  const grade = $derived(getGrade(tags));

  const scale = $derived.by(() => {
    if (!grade || grade.scale === "unknown") return null;
    return allScalesMap[grade.scale];
  });

  const color = $derived.by(() => {
    if (!grade || grade.scale === "unknown") return null;

    return getColorFromGrade(grade.v, grade.scale, mode.current === "dark");
  });

  const preferredGradeScale = $derived.by(() => {
    return getPreferredRouteGradingScale().current;
  });

  const convertedGrade = $derived.by(() => {
    if (
      !grade ||
      !scale ||
      grade.scale === "unknown" ||
      !preferredGradeScale ||
      preferredGradeScale === "local" ||
      preferredGradeScale === grade.scale
    )
      return null;

    return (
      convertGrade(grade.v, allScalesMap[grade.scale], allScalesMap[preferredGradeScale]) ?? null
    );
  });
</script>

{#if grade}
  <span class={className} style={`color: ${color || "currentColor"};`}>
    {#if convertedGrade}
      {convertedGrade}
    {:else}
      {grade.v}
    {/if}
  </span>
{/if}
