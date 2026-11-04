<script lang="ts">
  import { DAYS, formatTime, parseOpeningHours } from "#lib/data/parse/opening-hours.js";

  let { value }: { value: string } = $props();

  const week = $derived(parseOpeningHours(value));
  const width = 168;
  const rowHeight = 12;
  const labelWidth = 20;
  const chartWidth = width - labelWidth;
  const x = (minutes: number) => labelWidth + (minutes / 1440) * chartWidth;

  /** Ranges closing after midnight continue on the next day */
  const rows = $derived.by(() => {
    if (!week) return [];
    return week.map((_, day) => {
      const own = week[day]!.map((r) => ({ start: r.start, end: Math.min(r.end, 1440) }));
      const previous = week[(day + 6) % 7]!.filter((r) => r.end > 1440).map((r) => ({ start: 0, end: r.end - 1440 }));
      return [...own, ...previous];
    });
  });
</script>

{#if week}
  <svg
    viewBox="0 0 {width} {rowHeight * 7 + 12}"
    class="w-full max-w-sm text-xs"
    role="img"
    aria-label="Opening hours: {value}"
  >
    {#each [0, 6, 12, 18, 24] as h (h)}
      <line x1={x(h * 60)} x2={x(h * 60)} y1="0" y2={rowHeight * 7} class="stroke-border" stroke-width="0.5" />
      <text x={x(h * 60)} y={rowHeight * 7 + 9} text-anchor="middle" class="fill-muted-foreground" font-size="6">
        {h}
      </text>
    {/each}
    {#each rows as ranges, day (day)}
      <text x="0" y={day * rowHeight + 8} class="fill-muted-foreground" font-size="7">{DAYS[day]}</text>
      {#each ranges as r, i (i)}
        <rect
          x={x(r.start)}
          y={day * rowHeight + 2}
          width={x(r.end) - x(r.start)}
          height={rowHeight - 4}
          rx="1.5"
          class="fill-primary"
        >
          <title>{DAYS[day]} {formatTime(r.start)}-{formatTime(r.end)}</title>
        </rect>
      {/each}
    {/each}
  </svg>
{:else}
  <p class="text-sm">{value}</p>
{/if}
