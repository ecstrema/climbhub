<script lang="ts">
  import { scaleIdToTag, type Grade, type WithSourceTag } from "$lib/osm-tags";
  import { osmUser } from "@/shell/providers";
  import { Button } from "@/ui/button";
  import * as DropdownMenu from "@/ui/dropdown-menu/";
  import {
    allRouteScales,
    convertGrade,
    getGradeFromReference,
    getScaleFromId,
    type ScaleId,
  } from "@climbhub/holy-grade";
  import type { OsmFeature, Tags } from "osm-api";

  const {
    grade,
    feature,
  }: {
    grade: WithSourceTag<Grade>;
    feature: OsmFeature;
  } = $props();

  const changeGradingScale: (value: string) => void = (targetScaleId) => {
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

    if (grade.v.scale === "unknown") {
      console.log("unknown grade scale. Deleting it and adding another.");
      osmUser.deleteTag(feature, grade.source);
      osmUser.setTag(feature, newGradeKey, getGradeFromReference(50, scaleToConvertTo));
      return;
    }

    const scale = getScaleFromId(grade.v.scale);
    if (!scale) {
      console.log("Could not find scale with id", grade.v.scale);
      return;
    }

    const newGrade = convertGrade(grade.v.v, scale, scaleToConvertTo);
    if (!newGrade) {
      console.log(
        "Could not convert grade",
        grade.v.v,
        "from scale",
        scale.id,
        "to scale",
        scaleToConvertTo.id,
      );
      return;
    }

    osmUser.deleteTag(feature, grade.source);
    osmUser.setTag(feature, newGradeKey, newGrade);
  };
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="ghost">
        <span class="font-light text-xs text-muted-foreground">
          {grade.v.scale || "No scale"}
        </span>
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content class="max-h-[50vh] w-48">
    <DropdownMenu.RadioGroup onValueChange={changeGradingScale} value={grade.v.scale}>
      <DropdownMenu.GroupHeading>Change Grading Scale</DropdownMenu.GroupHeading>
      {#each allRouteScales as scale (scale.id)}
        <DropdownMenu.RadioItem value={scale.id} class="whitespace-nowrap">
          {scale.id}
        </DropdownMenu.RadioItem>
      {/each}
    </DropdownMenu.RadioGroup>
  </DropdownMenu.Content>
</DropdownMenu.Root>
