<script lang="ts">
  import GradeComparison from "./GradeComparison.svelte";
</script>

<svelte:head>
  <title>{import.meta.env.DEV ? "[DEV] " : ""}Climbhub - Grade Comparison</title>
</svelte:head>

<GradeComparison />
