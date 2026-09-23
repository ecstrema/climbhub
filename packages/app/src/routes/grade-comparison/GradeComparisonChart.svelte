<script lang="ts" generics="T extends ScaleId">
  import type { Scale, ScaleId } from "@climbhub/holy-grade";
  import { getGradeFromReference } from "@climbhub/holy-grade";
  import { Chart, Layer, Axis, Point, AnnotationLine } from "layerchart/svg";
  import { scaleLinear, scalePoint } from "d3-scale";
  import { mode } from "mode-watcher";
  import { getColorFromGrade } from "$lib/data/network/grade";

  let { scales }: { scales: readonly Scale<T>[] } = $props();

  // Only available in dev — dragging edits nothing persistent, it's just a way to preview a
  // new arrangement before copying the generated text back into the scale's own file.
  const editable = import.meta.env.DEV;

  function overrideKey(scaleId: T, grade: string): string {
    return `${scaleId}::${grade}`;
  }

  // Rank overrides from dragging, keyed by overrideKey(). Empty until the person drags a
  // point; the original scale files (and their gradeMapping) are never mutated.
  let overrides: Record<string, number> = $state({});
  let draggingKey: string | undefined = $state();

  // Transform the nested objects into a flat "tidy" array of data points
  const data = $derived(
    scales.flatMap((scale) =>
      [...scale.gradeMapping.entries()].map(([grade, rank]) => {
        const key = overrideKey(scale.id, grade);
        const reference = overrides[key] ?? rank;
        return {
          key,
          id: scale.id,
          reference,
          grade,
        };
      }),
    ),
  );

  let selectedReference: number | undefined = $state();
  const selectedData: Record<T, string | undefined> = $derived.by(() => {
    const res = {} as Record<T, string | undefined>;
    for (const scale of scales) {
      res[scale.id] =
        selectedReference !== undefined ? getGradeFromReference(selectedReference, scale) : undefined;
    }
    return res;
  });
  const padding = { top: 30, right: 20, bottom: 30, left: 40 };

  // The chart's height needs to scale with how many distinct grades the densest scale in
  // view has — not with how many scales there are. A single Aid scale with 11 grades needs
  // far less vertical room than 9 route scales where the densest (UIAA) has ~80. 45px per
  // grade in the densest scale keeps that scale's labels legible; floor/ceiling just keep
  // very small or very large groups sane.
  const height = $derived(
    Math.min(4000, Math.max(350, Math.max(...scales.map((s) => s.gradeMapping.size)) * 45)),
  );

  function resetOverrides() {
    overrides = {};
  }

  // Generates the exact `new Map([...])` text to paste back into a scale's own file,
  // reflecting any dragged edits.
  function generateMappingText(scale: Scale<T>): string {
    const lines = [...scale.gradeMapping.entries()].map(([grade, rank]) => {
      const key = overrideKey(scale.id, grade);
      const value = overrides[key] ?? rank;
      return `  [${JSON.stringify(grade)}, ${value}],`;
    });
    return `const gradeMapping: Scale["gradeMapping"] = new Map([\n${lines.join("\n")}\n]);`;
  }

  function downloadEditedMappings() {
    const text = scales.map((scale) => `// ${scale.id}\n${generateMappingText(scale)}`).join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "grade-mapping-edits.ts";
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

{#if editable}
  <div class="flex gap-2 mb-2">
    <button type="button" class="text-sm underline" onclick={downloadEditedMappings}>
      Download edited mapping(s)
    </button>
    <button type="button" class="text-sm underline" onclick={resetOverrides}>Reset drag edits</button>
  </div>
{/if}

<Chart
  {data}
  {height}
  valueAxis="y"
  x="id"
  y="reference"
  {padding}
  xScale={scalePoint().padding(0.5)}
  yReverse
>
  {#snippet children({ context })}
    {const referenceFromEvent = $derived((e: PointerEvent | MouseEvent) => {
      // Deliberately not e.offsetY: once a drag captures the pointer on a circle (see
      // onpointerdown below), offsetY becomes relative to that circle instead of the
      // background, which would silently throw off the position math mid-drag.
      // currentTarget (the Layer, since that's what this listener is bound to) isn't
      // affected by capture, only hit-testing/target is — so its rect is stable.
      const rect = (e.currentTarget as Element).getBoundingClientRect();
      const yPosition = e.clientY - rect.top;
      const value = context.yScale.invert?.(yPosition - padding.top);
      return value === undefined ? undefined : Math.round(value);
    })}
    <Layer
      onpointermove={(e) => {
        const ref = referenceFromEvent(e);
        if (editable && draggingKey !== undefined && ref !== undefined) {
          overrides = { ...overrides, [draggingKey]: ref };
        } else {
          selectedReference = ref;
        }
      }}
      onpointerleave={() => (selectedReference = undefined)}
      onclick={(e) => (selectedReference = referenceFromEvent(e))}
    >
      {#if selectedReference !== undefined}
        <AnnotationLine y={selectedReference} opacity={0.5} />
      {/if}
      <Axis placement="top" rule label="Scale" />
      <Axis placement="bottom" rule label="Scale" />
      <Axis placement="left" grid rule label="Reference" />
      {#each data as d (d.key)}
        <Point {d}>
          {#snippet children({ x, y })}
            {const selected = $derived(selectedData[d.id] === d.grade)}
            {const dragging = $derived(draggingKey === d.key)}
            <circle
              cx={x}
              cy={y}
              r={dragging ? 13 : 10}
              fill={selected || dragging
                ? "var(--primary)"
                : getColorFromGrade(d.grade, d.id, mode.current === "dark")}
              stroke-width={2}
              class="stroke-primary-foreground"
              style={editable ? "cursor: grab" : undefined}
              onpointerdown={editable
                ? (e) => {
                    draggingKey = d.key;
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }
                : undefined}
              onpointerup={editable ? () => (draggingKey = undefined) : undefined}
            />
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
          {/snippet}
        </Point>
      {/each}
    </Layer>
  {/snippet}
</Chart>
