<script lang="ts">
  import { getCurrentNode } from "@/shell/providers";
  import HolyGrade from "@/grade/holy-grade.svelte";

  import { getProcessedData } from "@/shell/providers/app-data.svelte";
  import EditableName from "$lib/components/editable/editable-name.svelte";
  import EditableDescription from "$lib/components/editable/editable-description.svelte";
  import EditableTags from "../../../lib/components/editable/editable-tags.svelte";
  import EditableGrade from "@/editable/editable-grade.svelte";
  import EditableGradeScale from "@/editable/editable-grade-scale.svelte";

  const data = $derived(getProcessedData().current);
</script>

{#if data && data.type === "route"}
  <div class="flex gap-2 items-baseline">
    <EditableName />
    <EditableGrade />
    <EditableGradeScale />
  </div>

  {#if data.type === "route" && data.coordinates}
    <p class="text-sm text-muted-foreground">{data.coordinates.lat}, {data.coordinates.lon}</p>
  {/if}

  <EditableDescription />

  <EditableTags />
{/if}
