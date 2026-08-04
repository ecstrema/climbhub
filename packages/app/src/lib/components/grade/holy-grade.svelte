<script lang="ts">
  import { getGrade } from "$lib/osm-tags";
  import type { Tags } from "osm-api";
  import { mode } from "mode-watcher";
  import { convertGrade, getScale } from "@openbeta/sandbag";
  import { getPreferredGradeScale } from "@/shell/providers/grade.svelte";

  const {
    tags,
  }: {
    tags: Tags;
  } = $props();

  const grade = $derived(getGrade(tags));

  const scale = $derived.by(() => {
    if (!grade || grade.scale === "unknown") return null;
    return getScale(grade.scale);
  });
  const color = $derived.by(() => {
    if (!grade) return null;

    if (!scale) {
      return "hsl(0deg 0% 50%)";
    }

    let score = scale.getScore(grade.v) || 0;
    if (Array.isArray(score)) {
      score = (score[0] + score[1]) / 2;
    }
    score = 120 - (score / 100) * 120;

    return `hsl(${score.toFixed(0)}deg 80% ${mode.current === "dark" ? 30 : 70}%);`;
  });

  const preferredGradeScale = $derived.by(() => {
    return getPreferredGradeScale().current;
  });

  const convertedGrade = $derived.by(() => {
    if (!grade || !scale || grade.scale === "unknown") return null;

    const converted = convertGrade(grade.v, grade.scale, preferredGradeScale);
    if (!converted) return null;

    return {
      v: converted,
      scale: preferredGradeScale,
    };
  });
</script>

{#if grade}
  {#if convertedGrade}
    <span class="text-xs font-semibold" style={`color: ${color};`}>{convertedGrade.v}</span>
  {:else}
    <span class="text-xs font-semibold" style={`color: ${color};`}>{grade.v}</span>
  {/if}
{/if}
