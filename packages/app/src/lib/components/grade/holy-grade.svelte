<script lang="ts">
  import { mode } from "mode-watcher";
  import { getPreferredRouteGradingScale } from "#components/shell/providers/settings.svelte";
  import { getScale, convertGrade } from "@climbhub/holy-grade";
  import type { Grade } from "#lib/types.js";
  import { getColorFromGrade } from "#lib/data/network/grade.js";

  const {
    grade,
    convert = true,
    class: className = "",
  }: {
    grade?: Grade;
    class?: string;
    convert?: boolean;
  } = $props();

  const scale = $derived.by(() => {
    if (!grade || grade.scale === "unknown") return;
    return getScale(grade.scale);
  });

  const color = $derived.by(() => {
    if (!grade || grade.scale === "unknown") return;

    return getColorFromGrade(grade.v, grade.scale, mode.current === "dark");
  });

  const preferredGradeScale = $derived.by(() => {
    return getPreferredRouteGradingScale().current;
  });

  const convertedGrade: string | undefined = $derived.by(() => {
    if (
      !grade ||
      !scale ||
      !grade.scale ||
      grade.scale === "unknown" ||
      !preferredGradeScale ||
      preferredGradeScale === "local" ||
      preferredGradeScale === grade.scale
    )
      return;

    if (!convert) return grade.v;

    return convertGrade(grade.v, getScale(grade.scale)!, getScale(preferredGradeScale)!);
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
