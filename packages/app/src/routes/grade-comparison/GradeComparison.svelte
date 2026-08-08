<script lang="ts">
  import { allScales, getGradeFromReference, type ScaleName } from "holy-grade";
  import { Chart, Layer, Axis, Point, AnnotationLine } from "layerchart/svg";
  import { scalePoint } from "d3-scale";
  import { mode } from "mode-watcher";
  import { getColorFromGrade } from "@/grade/helpers";

  // Transform the nested objects into a flat "tidy" array of data points
  const data = allScales
    .filter((scale) => scale.gradeType === "route")
    .flatMap((scale) => {
      return Object.entries(scale.gradeMapping).map(([grade, ref]) => ({
        nameShort: scale.nameShort,
        reference: ref,
        grade: grade,
        showLabel: [1, 7].includes(ref % 12),
      }));
    });

  let selectedReference: number | null = $state(null);
  const selectedData: Record<ScaleName, string | null> = $derived.by(() => {
    const s = {} as Record<ScaleName, string | null>;
    for (const scale of allScales) {
      if (selectedReference !== null) {
        const grade = getGradeFromReference(selectedReference, scale);
        s[scale.nameShort] = grade;
      } else {
        s[scale.nameShort] = null;
      }
    }
    return s;
  });
  const padding = { top: 30, right: 20, bottom: 30, left: 40 };
</script>

<div class="flex flex-col items-center justify-center gap-4 p-8 max-w-3xl mx-auto">
  <h1 class="prose dark:prose-invert">Grade Comparison</h1>
  <Chart
    ssr
    valueAxis="y"
    {data}
    height={2400}
    x="nameShort"
    y="reference"
    {padding}
    xScale={scalePoint().padding(0.5)}
    yReverse
  >
    {#snippet children({ context })}
      {@const selectedReferenceFromPosition = (yPosition: number) => {
        return Math.round(context.yScale.invert?.(yPosition - padding.top) || null);
      }}
      <Layer
        onpointermove={(e) => (selectedReference = selectedReferenceFromPosition(e.offsetY))}
        onpointerleave={() => (selectedReference = null)}
        onclick={(e) => (selectedReference = selectedReferenceFromPosition(e.offsetY))}
      >
        {#if selectedReference !== null}
          <AnnotationLine y={selectedReference} opacity={0.5} />
        {/if}
        <Axis placement="top" rule label="Scale" />
        <Axis placement="bottom" rule label="Scale" />
        <Axis placement="left" grid rule label="Reference" />
        {#each data as d, i (i)}
          <Point {d}>
            {#snippet children({ x, y })}
              {@const selected = selectedData[d.nameShort as ScaleName] === d.grade}
              <circle
                cx={x}
                cy={y}
                r={8}
                fill={selected
                  ? "var(--primary)"
                  : getColorFromGrade(
                      { v: d.grade, scale: d.nameShort as ScaleName },
                      mode.current === "dark",
                    )}
                stroke-width={2}
                class="stroke-primary-foreground"
              />
              {#if d.showLabel || selected}
                <text
                  x={x + 10}
                  {y}
                  class="text-s fill-foreground stroke-background stroke-2 [paint-order:stroke_fill] [alignment-baseline:middle] [text-anchor:left]"
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
