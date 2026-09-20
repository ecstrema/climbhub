<script lang="ts">
  import { allRouteScales, getGradeFromReference, type RouteScaleId } from "@climbhub/holy-grade";
  import { Chart, Layer, Axis, Point, AnnotationLine } from "layerchart/svg";
  import { scalePoint } from "d3-scale";
  import { mode } from "mode-watcher";
  import { getColorFromGrade } from "$lib/data/network/grade";

  // Transform the nested objects into a flat "tidy" array of data points
  const data = allRouteScales.flatMap((scale) => {
    return Object.entries(scale.gradeMapping).map(([grade, ref]) => ({
      id: scale.id,
      reference: ref,
      grade: grade,
      showLabel: [1, 7].includes(ref % 12),
    }));
  });

  let selectedReference: number | undefined = $state();
  const selectedData: Record<RouteScaleId, string | undefined> = $derived.by(() => {
    const s = {} as Record<RouteScaleId, string | undefined>;
    for (const scale of allRouteScales) {
      s[scale.id] = selectedReference ? getGradeFromReference(selectedReference, scale) : undefined;
    }
    return s;
  });
  const padding = { top: 30, right: 20, bottom: 30, left: 40 };
</script>

<div class="flex flex-col items-center justify-center gap-4 p-8 max-w-3xl mx-auto">
  <h1 class="prose dark:prose-invert">Grade Comparison</h1>
  <Chart
    {data}
    height={4000}
    valueAxis="y"
    x="id"
    y="reference"
    {padding}
    xScale={scalePoint().padding(0.5)}
    yReverse
  >
    {#snippet children({ context })}
      {const selectedReferenceFromPosition = (yPosition: number) => {
        return Math.round(context.yScale.invert?.(yPosition - padding.top) || undefined);
      }}
      <Layer
        onpointermove={(e) => (selectedReference = selectedReferenceFromPosition(e.offsetY))}
        onpointerleave={() => (selectedReference = undefined)}
        onclick={(e) => (selectedReference = selectedReferenceFromPosition(e.offsetY))}
      >
        {#if selectedReference !== undefined}
          <AnnotationLine y={selectedReference} opacity={0.5} />
        {/if}
        <Axis placement="top" rule label="Scale" />
        <Axis placement="bottom" rule label="Scale" />
        <Axis placement="left" grid rule label="Reference" />
        {#each data as d, i (i)}
          <Point {d}>
            {#snippet children({ x, y })}
              {const selected = selectedData[d.id] === d.grade}
              <circle
                cx={x}
                cy={y}
                r={10}
                fill={selected
                  ? "var(--primary)"
                  : getColorFromGrade(d.grade, d.id, mode.current === "dark")}
                stroke-width={2}
                class="stroke-primary-foreground"
              />
              {#if d.showLabel || selected}
                <text
                  x={x + 12}
                  {y}
                  alignment-baseline="central"
                  paint-order="stroke fill"
                  text-anchor="left"
                  class="text-s fill-foreground stroke-background stroke-2"
                >
                  {d.grade}
                </text>
              {/if}
            {/snippet}
          </Point>
        {/each}
      </Layer>
    {/snippet}
  </Chart>
</div>
