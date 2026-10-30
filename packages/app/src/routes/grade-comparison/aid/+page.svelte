<script lang="ts">
  import { allAidScales } from "@climbhub/holy-grade";
  import GradeComparisonChart from "../GradeComparisonChart.svelte";
</script>

<svelte:head>
  <title>{import.meta.env.DEV ? "[DEV] " : ""}Climbhub - Aid Grade Comparison</title>
</svelte:head>

<GradeComparisonChart scales={allAidScales} />
