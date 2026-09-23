<script lang="ts">
  import * as Tabs from "$lib/components/ui/tabs";
  import { allRouteScales, allBoulderScales, allIceScales, allAidScales } from "@climbhub/holy-grade";
  import GradeComparisonChart from "./GradeComparisonChart.svelte";
</script>

<div class="flex flex-col items-center justify-center gap-4 p-8 max-w-3xl mx-auto">
  <h1 class="prose dark:prose-invert">Grade Comparison</h1>
  <Tabs.Root value="route" class="w-full">
    <Tabs.List>
      <Tabs.Trigger value="route">Route</Tabs.Trigger>
      <Tabs.Trigger value="boulder">Boulder</Tabs.Trigger>
      <Tabs.Trigger value="ice">Ice</Tabs.Trigger>
      <Tabs.Trigger value="aid">Aid</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="route">
      <GradeComparisonChart scales={allRouteScales} />
    </Tabs.Content>
    <Tabs.Content value="boulder">
      <GradeComparisonChart scales={allBoulderScales} />
    </Tabs.Content>
    <Tabs.Content value="ice">
      <GradeComparisonChart scales={allIceScales} />
    </Tabs.Content>
    <Tabs.Content value="aid">
      <GradeComparisonChart scales={allAidScales} />
    </Tabs.Content>
  </Tabs.Root>
</div>
