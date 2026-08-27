<script lang="ts">
  import HolyGrade from "@/grade/holy-grade.svelte";
  import {
    getPreferredBoulderGradingScale,
    getPreferredRouteGradingScale,
  } from "@/shell/providers";
  import { getCurrentNode, getProcessedData } from "@/shell/providers/app-data.svelte";
  import { Button } from "@/ui/button";
  import * as DropdownMenu from "@/ui/dropdown-menu/";
  import { allScalesMap } from "@climbhub/holy-grade";

  const currentNode = $derived(getCurrentNode().current);

  let grade = $derived.by(() => {
    const d = getProcessedData().current;
    if (!d || d.type !== "route") return;

    return d.grade;
  });

  const scale = $derived.by(() => {
    if (!grade || grade.v.scale === "unknown") return;

    return allScalesMap[grade.v.scale];
  });

  const isGradeAlreadyInRightScale = $derived.by(() => {
    const routeScale = grade?.v.scale;

    if (!routeScale) return false;

    const preferredRouteGradingScale = getPreferredRouteGradingScale().current;
    const preferredBoulderGradingScale = getPreferredBoulderGradingScale().current;

    return (
      preferredRouteGradingScale === grade.v.scale || preferredBoulderGradingScale === routeScale
    );
  });
</script>

{#if currentNode.own.type === "node"}
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
        bind:value={currentNode.own.tags[grade?.source || "climbing:grade:yds"]}
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
{/if}
