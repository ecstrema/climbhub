<script lang="ts">
  import { getAppState } from "$lib/data/app-state";
  import { type WithSourceTag, scaleIdToTag } from "$lib/data/parse/osm-tags";
  import type { Grade } from "$lib/types";
  import { Button } from "@/ui/button";
  import * as DropdownMenu from "@/ui/dropdown-menu/";
  import {
    allRouteScales,
    convertGrade,
    getGradeFromReference,
    getScaleFromId,
    type ScaleId,
  } from "@climbhub/holy-grade";
  import type { OsmFeature } from "osm-api";

  const {
    grade,
    feature,
    featureSlug,
  }: {
    grade: WithSourceTag<Grade>;
    feature: OsmFeature;
    featureSlug: string;
  } = $props();

  const appState = getAppState();

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
      appState.deleteTag(featureSlug, grade.source);
      appState.setTag(featureSlug, newGradeKey, getGradeFromReference(50, scaleToConvertTo));
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

    appState.deleteTag(featureSlug, grade.source);
    appState.setTag(featureSlug, newGradeKey, newGrade);
  };
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger disabled={!appState.osmUser.loggedIn}>
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
