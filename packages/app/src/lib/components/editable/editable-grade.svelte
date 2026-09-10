<script lang="ts">
  import EditableGradeValue from "./editable-grade-value.svelte";
  import EditableGradeScale from "./editable-grade-scale.svelte";
  import type { Grade, WithSourceTag } from "$lib/osm-tags";
  import type { OsmFeature } from "osm-api";
  import EditableTooltip from "./editable-tooltip.svelte";

  const {
    grade,
    feature,
  }: {
    grade: WithSourceTag<Grade>;
    feature: OsmFeature;
  } = $props();
</script>

<EditableTooltip>
  <EditableGradeValue {feature} {grade} />
  <EditableGradeScale {feature} {grade} />
</EditableTooltip>
