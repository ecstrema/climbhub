<script lang="ts">
  import { allDangerScales } from "@climbhub/holy-grade";
  import GradeComparisonChart from "../GradeComparisonChart.svelte";
</script>

<svelte:head>
  <title>{import.meta.env.DEV ? "[DEV] " : ""}Climbhub - Danger Grade Comparison</title>
</svelte:head>

<GradeComparisonChart scales={allDangerScales} />
