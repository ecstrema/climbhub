<script lang="ts">
  import { allRouteScales } from "@climbhub/holy-grade";
  import GradeComparisonChart from "../GradeComparisonChart.svelte";
</script>

<svelte:head>
  <title>{import.meta.env.DEV ? "[DEV] " : ""}Climbhub - Route Grade Comparison</title>
</svelte:head>

<GradeComparisonChart scales={allRouteScales} />
