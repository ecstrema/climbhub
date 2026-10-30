<script lang="ts">
  import { allIceScales } from "@climbhub/holy-grade";
  import GradeComparisonChart from "../GradeComparisonChart.svelte";
</script>

<svelte:head>
  <title>{import.meta.env.DEV ? "[DEV] " : ""}Climbhub - Ice Grade Comparison</title>
</svelte:head>

<GradeComparisonChart scales={allIceScales} />
