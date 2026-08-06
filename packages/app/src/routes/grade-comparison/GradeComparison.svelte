<script>
  import { Plot, Frame, GridX, GridY, AxisX, AxisY, Line, Dot, Pointer, Text } from "svelteplot";
  import { allScales } from "holy-grade";

  // Transform the nested objects into a flat "tidy" array of data points
  const data = allScales
    .filter((scale) => scale.gradeType === "route")
    .flatMap((scale) => {
      return Object.entries(scale.gradeMapping).map(([grade, ref]) => ({
        nameShort: scale.nameShort,
        reference: ref,
        grade: grade,
      }));
    });
  // .sort((a, b) => a.reference - b.reference); // Sorting ensures the lines connect sequentially
</script>

<div class="flex flex-col items-center justify-center gap-4 px-4 py-8">
  <Plot height={1000} inset={40} class="w-full max-w-4xl" title="Grade Comparison">
    <GridX />
    <GridY />
    <AxisX title="Scale" />
    <AxisY title="Reference Value" />

    <Dot {data} x="nameShort" y="reference" fill r={3} />

    <Pointer {data} x="nameShort" y="reference">
      {#snippet children({ data })}
        <Text
          {data}
          fill="currentColor"
          x="nameShort"
          y="reference"
          text={(d) => `${d.grade}: ${d.reference}`}
          lineAnchor="middle"
          textAnchor="start"
          fontWeight="bold"
          dx={10}
        />
        <Dot {data} x="nameShort" y="reference" class="text-amber-500" fill r={5} />
      {/snippet}
    </Pointer>
  </Plot>
</div>
