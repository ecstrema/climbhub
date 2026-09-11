<script lang="ts">
  import EditableGradeValue from "./editable-grade-value.svelte";
  import EditableGradeScale from "./editable-grade-scale.svelte";
  import type { Grade, WithSourceTag } from "$lib/osm-tags";
  import type { OsmFeature } from "osm-api";
  import EditableTooltip from "./editable-tooltip.svelte";
  import { Button } from "@/ui/button";
  import { osmUser } from "@/shell/providers";

  const {
    grade,
    feature,
  }: {
    grade: WithSourceTag<Grade> | undefined;
    feature: OsmFeature;
  } = $props();

  function addGrade() {
    // TODO: use current grade scale from the local area's settings.
    osmUser.setTag(feature, "climbing:grade:yds_class", "5.10a");
  }
</script>

<EditableTooltip>
  {#snippet children(props)}
    {#if grade}
      <div class="flex gap-2 items-center" {...props}>
        <EditableGradeValue {feature} {grade} />
        <EditableGradeScale {feature} {grade} />
      </div>
    {:else}
      <Button class="text-muted-foreground" onclick={addGrade} variant="outline" {...props}>
        Add Grade
      </Button>
    {/if}
  {/snippet}
</EditableTooltip>
