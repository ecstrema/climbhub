<script lang="ts">
  import { Button } from "#components/ui/button/index.js";
  import Input from "#components/ui/input/input.svelte";
  import XIcon from "@lucide/svelte/icons/x";
  import type { SearchFilters } from "#lib/data/db/types.js";
  import { gradeTextToReference } from "#lib/data/db/grade-text.js";

  let {
    filters = $bindable(),
    gradeText = $bindable(),
  }: { filters: SearchFilters; gradeText: { min: string; max: string } } = $props();

  const TYPES = [
    ["route", "Routes"],
    ["area", "Areas"],
    ["gym", "Gyms"],
  ] as const;

  const STYLES = [
    ["sport", "Sport"],
    ["trad", "Trad"],
    ["boulder", "Boulder"],
    ["toprope", "Top rope"],
    ["speed", "Speed"],
    ["multipitch", "Multi-pitch"],
    ["ice", "Ice"],
    ["mixed", "Mixed"],
    ["dry", "Dry tooling"],
    ["aid", "Aid"],
    ["deepwater", "Deep-water solo"],
  ] as const;

  let tagKey = $state("");
  let tagValue = $state("");

  const minInvalid = $derived(gradeText.min.trim() !== "" && gradeTextToReference(gradeText.min) === undefined);
  const maxInvalid = $derived(gradeText.max.trim() !== "" && gradeTextToReference(gradeText.max) === undefined);

  function toggle<T extends string>(list: T[], item: T): T[] {
    return list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
  }

  function addTag() {
    const key = tagKey.trim();
    if (!key) return;
    filters.tags = [...filters.tags, { key, value: tagValue.trim() }];
    tagKey = "";
    tagValue = "";
  }

  function reset() {
    gradeText = { min: "", max: "" };
    filters.types = [];
    filters.styles = [];
    filters.tags = [];
  }
</script>

<div class="flex flex-col gap-2 text-sm">
  <div class="flex flex-wrap gap-x-3 gap-y-1">
    {#each TYPES as [type, label] (type)}
      <label class="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={filters.types.includes(type)}
          onchange={() => (filters.types = toggle(filters.types, type))}
        />
        {label}
      </label>
    {/each}
  </div>

  <div class="flex flex-wrap gap-x-3 gap-y-1">
    {#each STYLES as [style, label] (style)}
      <label class="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={filters.styles.includes(style)}
          onchange={() => (filters.styles = toggle(filters.styles, style))}
        />
        {label}
      </label>
    {/each}
  </div>

  <div class="flex items-center gap-2">
    <Input placeholder="Min grade" class="h-8" aria-invalid={minInvalid} bind:value={gradeText.min} />
    <Input placeholder="Max grade" class="h-8" aria-invalid={maxInvalid} bind:value={gradeText.max} />
  </div>

  <form
    class="flex items-center gap-2"
    onsubmit={(e) => {
      e.preventDefault();
      addTag();
    }}
  >
    <Input placeholder="Tag, e.g. climbing:rock" class="h-8" bind:value={tagKey} />
    <Input placeholder="Value" class="h-8" bind:value={tagValue} />
    <Button size="xs" variant="outline" type="submit">Add</Button>
  </form>

  {#if filters.tags.length > 0}
    <div class="flex flex-wrap gap-1">
      {#each filters.tags as tag, i (i)}
        <Button size="xs" variant="secondary" onclick={() => (filters.tags = filters.tags.filter((_, j) => j !== i))}>
          {tag.key}{tag.value ? `=${tag.value}` : ""}
          <XIcon class="size-3" />
        </Button>
      {/each}
    </div>
  {/if}

  <Button size="xs" variant="ghost" class="self-end" onclick={reset}>Clear filters</Button>
</div>
