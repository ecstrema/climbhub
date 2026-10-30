<script lang="ts">
  import { allBoulderScales } from "@climbhub/holy-grade";
  import GradeComparisonChart from "../GradeComparisonChart.svelte";
</script>

<svelte:head>
  <title>{import.meta.env.DEV ? "[DEV] " : ""}Climbhub - Boulder Grade Comparison</title>
</svelte:head>

<GradeComparisonChart scales={allBoulderScales} />
