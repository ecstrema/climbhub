<script lang="ts">
  import EditableName from "@/editable/editable-name.svelte";
  import EditableDescription from "$lib/components/editable/editable-description.svelte";
  import EditableTags from "../../../lib/components/editable/editable-tags.svelte";
  import EditableGrade from "@/editable/editable-grade.svelte";
  import EditableGradeScale from "@/editable/editable-grade-scale.svelte";
  import type { DataTree } from "$lib/types";
  import type { OsmFeature } from "osm-api";
  import { getCoordinates, getGrade } from "$lib/osm-tags";
  import Button from "@/ui/button/button.svelte";

  let {
    item = $bindable(),
  }: {
    item: DataTree<OsmFeature>;
  } = $props();

  let tags = $derived(item.feature.tags || {});

  let coordinates = $derived(getCoordinates(item.feature));
  let grade = $derived(getGrade(tags));

  function addGrade() {
    tags["climbing:grade:yds_class"] = "5.10a";
  }
</script>

<div class="flex gap-2 items-baseline">
  <EditableName bind:tags />
  {#if grade}
    <EditableGrade bind:tags {grade} />
    <EditableGradeScale bind:tags {grade} />
  {:else}
    <Button class="text-muted-foreground" onclick={addGrade} variant="outline">Add Grade</Button>
  {/if}
</div>

{#if coordinates}
  <p class="text-sm text-muted-foreground">{coordinates.lat}, {coordinates.lon}</p>
{/if}

<EditableDescription bind:tags />

<EditableTags bind:feature={item.feature} />
