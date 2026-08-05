<script lang="ts">
  import { getGrade } from "$lib/osm-tags";
  import type { Tags } from "osm-api";
  import { mode } from "mode-watcher";
  import { getPreferredGradeScale } from "@/shell/providers/settings.svelte";
  import { allScalesMap, convertGrade, getReference } from "holy-grade";

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
    if (!grade) return null;

    if (!scale) {
      return "hsl(0deg 0% 50%)";
    }

    let score = getReference(grade.v, scale);
    score = 120 - (score / 100) * 120;

    return `hsl(${score.toFixed(0)}deg 80% ${mode.current === "dark" ? 30 : 70}%);`;
  });

  const preferredGradeScale = $derived.by(() => {
    return getPreferredGradeScale().current;
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
  <span class={className} style={`color: ${color};`}>
    {#if convertedGrade}
      {convertedGrade}
    {:else}
      {grade.v}
    {/if}
  </span>
{/if}
