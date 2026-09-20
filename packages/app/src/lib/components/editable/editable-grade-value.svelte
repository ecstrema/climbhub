<script lang="ts">
    import { getAppState } from "$lib/data/app-state";
  import type { WithSourceTag } from "$lib/data/parse/osm-tags";
  import type { Grade } from "$lib/types";
  import HolyGrade from "@/grade/holy-grade.svelte";
  import { Button } from "@/ui/button";
  import * as DropdownMenu from "@/ui/dropdown-menu/";
  import { allScalesMap } from "@climbhub/holy-grade";
  import type { OsmFeature, Tags } from "osm-api";

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

  const scale = $derived.by(() => {
    if (!grade || grade.v.scale === "unknown") return;

    return allScalesMap[grade.v.scale];
  });

  const tags = $derived(feature.tags || {});

  const gradeTagKey = $derived(grade.source || "climbing:grade:yds_class");
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger disabled={!appState.osmUser.loggedIn}>
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
      bind:value={() => tags[gradeTagKey], (v) => appState.setTag(featureSlug, gradeTagKey, v)}
    >
      {const sortedGradeMapping = Object.entries(scale?.gradeMapping ?? {})
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
