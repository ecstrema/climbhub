<script lang="ts">
  import type { Scale, GradeType, GradeMapping } from "holy-grade";
  import { French, YDS } from "holy-grade";

  interface Props {
    height?: number;
    columnWidth?: number;
  }

  let { height = 1200, columnWidth = 120 }: Props = $props();

  const padding = { top: 60, bottom: 40, left: 20, right: 20 };

  const scales: {
    gradeMapping: GradeMapping;
    nameShort: string;
  }[] = [
    { gradeMapping: French.gradeMapping, nameShort: French.nameShort },
    { gradeMapping: YDS.gradeMapping, nameShort: YDS.nameShort },
  ];

  let width = $derived(scales.length * columnWidth + padding.left + padding.right);

  let allRefs = $derived(scales.flatMap((scale) => Object.values(scale.gradeMapping)));
  let minRef = $derived(Math.min(...allRefs));
  let maxRef = $derived(Math.max(...allRefs));

  function getY(ref: number) {
    const range = maxRef - minRef || 1;
    const availableHeight = height - padding.top - padding.bottom;
    return padding.top + availableHeight - ((ref - minRef) / range) * availableHeight;
  }
</script>

<div class="chart-container">
  <svg {width} {height}>
    {#each scales as scale, i}
      <!-- Create a column for each scale -->
      <g transform="translate({padding.left + i * columnWidth}, 0)">
        <!-- The central spine (axis line) -->
        <line
          x1={columnWidth / 2}
          y1={padding.top}
          x2={columnWidth / 2}
          y2={height - padding.bottom}
          stroke="#cbd5e1"
          stroke-width="2"
        />

        <!-- Scale Header / Title -->
        <text
          x={columnWidth / 2}
          y={padding.top - 20}
          text-anchor="middle"
          font-weight="bold"
          fill="#334155"
        >
          {scale.nameShort}
        </text>

        <!-- Grade ticks and labels -->
        {#each Object.entries(scale.gradeMapping) as [grade, ref]}
          <g transform="translate({columnWidth / 2}, {getY(ref)})">
            <!-- Tick mark -->
            <line x1="-6" y1="0" x2="6" y2="0" stroke="#64748b" stroke-width="1.5" />

            <!-- Grade text -->
            <text x="12" y="4" font-size="11" fill="#475569">
              {grade}
            </text>
          </g>
        {/each}
      </g>
    {/each}
  </svg>
</div>

<style>
  .chart-container {
    width: 100%;
    overflow-x: auto;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  }
</style>
