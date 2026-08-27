<script lang="ts">
  import { scaleIdToTag } from "$lib/osm-tags";
  import { getCurrentNode, getProcessedData } from "@/shell/providers/app-data.svelte";
  import { Button } from "@/ui/button";
  import * as DropdownMenu from "@/ui/dropdown-menu/";
  import {
    allRouteScales,
    convertGrade,
    getGradeFromReference,
    getScaleFromId,
    type ScaleId,
  } from "@climbhub/holy-grade";

  const processedData = $derived(getProcessedData().current);
  const currentNode = $derived(getCurrentNode().current);

  const changeGradingScale: (value: string) => void = (targetScaleId) => {
    const ownData = currentNode.own;
    if (ownData.type === "geographic") return;
    if (processedData?.type !== "route") return;

    ownData.tags ||= {};

    if (!processedData.grade) {
      // If there is no grade, there should be a separate button to add a grade
      console.log("no grade in processed data");
      return;
    }

    const scaleToConvertTo = getScaleFromId(targetScaleId as ScaleId);
    if (!scaleToConvertTo) {
      console.log("Could not find scale with id", targetScaleId);
      return;
    }

    const newGradeKey = scaleIdToTag(targetScaleId as ScaleId);
    if (!newGradeKey) {
      console.log("Could not find tag for scale with id", targetScaleId);
      return;
    }

    if (processedData.grade.v.scale === "unknown") {
      console.log("unknown grade scale. Deleting it and adding another.");
      delete ownData.tags[processedData.grade.source];

      ownData.tags[newGradeKey] = getGradeFromReference(50, scaleToConvertTo);
      return;
    }

    const scale = getScaleFromId(processedData.grade.v.scale);
    if (!scale) {
      console.log("Could not find scale with id", processedData.grade.v.scale);
      return;
    }

    const newGrade = convertGrade(processedData.grade.v.v, scale, scaleToConvertTo);
    if (!newGrade) {
      console.log(
        "Could not convert grade",
        processedData.grade.v.v,
        "from scale",
        scale.id,
        "to scale",
        scaleToConvertTo.id,
      );
      return;
    }

    if (Object.prototype.hasOwnProperty.call(ownData.tags, processedData.grade.source)) {
      delete ownData.tags[processedData.grade.source];
    }
    ownData.tags[newGradeKey] = newGrade;
  };
</script>

{#if processedData?.type === "route"}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button {...props} variant="ghost">
          <span class="font-light text-xs text-muted-foreground">
            {processedData.grade?.v.scale || "No scale"}
          </span>
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content class="max-h-[50vh] w-48">
      <DropdownMenu.RadioGroup
        onValueChange={changeGradingScale}
        value={processedData.grade?.v.scale}
      >
        <DropdownMenu.GroupHeading>Change Grading Scale</DropdownMenu.GroupHeading>
        {#each allRouteScales as scale (scale.id)}
          <DropdownMenu.RadioItem value={scale.id} class="whitespace-nowrap">
            {scale.id}
          </DropdownMenu.RadioItem>
        {/each}
      </DropdownMenu.RadioGroup>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{/if}
