<script lang="ts">
  import { getAppState } from "#lib/data/app-state.js";
  import type { WithSourceTag } from "#lib/data/parse/osm-tags.js";
  import type { Grade } from "#lib/types.js";
  import HolyGrade from "#components/grade/holy-grade.svelte";
  import Button from "#components/ui/button/button.svelte";
  import * as DropdownMenu from "#components/ui/dropdown-menu/index.ts";
  import { getScale } from "@climbhub/holy-grade";
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

  const scale = $derived.by(() => {
    if (!grade || grade.v.scale === "unknown") return;

    return getScale(grade.v.scale);
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
    <DropdownMenu.RadioGroup bind:value={() => tags[gradeTagKey], (v) => appState.setTag(featureSlug, gradeTagKey, v)}>
      {#each scale?.gradeMapping.keys() as name (name)}
        <DropdownMenu.RadioItem value={name} class="whitespace-nowrap">
          <HolyGrade grade={{ v: name, scale: scale?.id || "YDS" }} convert={true} />
        </DropdownMenu.RadioItem>
      {/each}
    </DropdownMenu.RadioGroup>
  </DropdownMenu.Content>
</DropdownMenu.Root>
