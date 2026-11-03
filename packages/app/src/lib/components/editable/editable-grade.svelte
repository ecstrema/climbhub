<script lang="ts">
  import EditableGradeValue from "./editable-grade-value.svelte";
  import EditableGradeScale from "./editable-grade-scale.svelte";
  import type { OsmFeature } from "osm-api";
  import EditableTooltip from "./editable-tooltip.svelte";
  import { Button } from "#components/ui/button/index.js";
  import type { WithSourceTag } from "#lib/data/parse/osm-tags.js";
  import type { Grade } from "#lib/types.js";
  import { getAppState } from "#lib/data/app-state.js";

  const {
    grade,
    feature,
    featureSlug,
  }: {
    grade: WithSourceTag<Grade> | undefined;
    feature: OsmFeature;
    featureSlug: string;
  } = $props();

  const appState = getAppState();

  function addGrade() {
    // TODO: use current grade scale from the local area's settings.
    appState.setTag(featureSlug, "climbing:grade:yds_class", "5.10a");
  }
</script>

<EditableTooltip>
  {#snippet children(props)}
    {#if grade}
      <div class="flex gap-2 items-center" {...props}>
        <EditableGradeValue {feature} {grade} {featureSlug} />
        <EditableGradeScale {feature} {grade} {featureSlug} />
      </div>
    {:else}
      <Button class="text-muted-foreground" onclick={addGrade} variant="outline" {...props}>Add Grade</Button>
    {/if}
  {/snippet}
</EditableTooltip>
