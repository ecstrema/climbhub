<script lang="ts">
  import type { Grade, WithSourceTag } from "$lib/osm-tags";
  import HolyGrade from "@/grade/holy-grade.svelte";
  import {
    osmUser,
    getPreferredBoulderGradingScale,
    getPreferredRouteGradingScale,
  } from "@/shell/providers";
  import { Button } from "@/ui/button";
  import * as DropdownMenu from "@/ui/dropdown-menu/";
  import { allScalesMap } from "@climbhub/holy-grade";
  import type { OsmFeature, Tags } from "osm-api";

  const {
    grade,
    feature,
  }: {
    grade: WithSourceTag<Grade>;
    feature: OsmFeature;
  } = $props();

  const scale = $derived.by(() => {
    if (!grade || grade.v.scale === "unknown") return;

    return allScalesMap[grade.v.scale];
  });

  const tags = $derived(feature.tags || {});

  const gradeTagKey = $derived(grade.source || "climbing:grade:yds_class");
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="ghost">
        <HolyGrade class="font-semibold text-sm" grade={grade?.v} />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content class="max-h-[50vh] w-48">
    <DropdownMenu.Label>
      Change Grade
      <!-- TODO: add an information on hover about not seeing all grades -->
    </DropdownMenu.Label>
    <DropdownMenu.RadioGroup
      bind:value={() => tags[gradeTagKey], (v) => osmUser.setTag(feature, gradeTagKey, v ?? "")}
    >
      {@const sortedGradeMapping = Object.entries(scale?.gradeMapping ?? {})
        .sort(([_a, a], [_b, b]) => a - b)
        .map(([k, _]) => k)}
      {#each sortedGradeMapping as name (name)}
        <DropdownMenu.RadioItem value={name} class="whitespace-nowrap">
          <HolyGrade grade={{ v: name, scale: scale?.id || "YDS" }} convert={true} />
        </DropdownMenu.RadioItem>
      {/each}
    </DropdownMenu.RadioGroup>
  </DropdownMenu.Content>
</DropdownMenu.Root>
