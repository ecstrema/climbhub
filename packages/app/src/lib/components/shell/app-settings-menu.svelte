<script lang="ts">
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import * as DropdownMenu from "@/ui/dropdown-menu";
  import { Button } from "@/ui/button";
  import * as Tooltip from "@/ui/tooltip";
  import { Tooltip as BitsUiTooltip } from "bits-ui";

  import { setMode, userPrefersMode } from "mode-watcher";

  import {
    allBoulderScales,
    french,
    convertGrade,
    type Scale,
    allRouteScales,
    type ScaleId,
  } from "@climbhub/holy-grade";
  import type { FromCurrent } from "./providers/types";
  import {
    getPreferredBoulderGradingScale,
    getPreferredRouteGradingScale,
  } from "./providers/settings.svelte";
    import { getAppState } from "$lib/data/app-state";

  const appState = getAppState();

  const osmButton = $derived.by(() => {
    switch (appState.osmUser.loggedIn) {
      case undefined:
        return {
          action: () => {},
          label: "OSM loading",
        };
      case true:
        return {
          action: () => appState.osmUser.logout(),
          label: "Logout OSM",
        };
      case false:
        return {
          action: () => appState.osmUser.login(),
          label: "Login with OSM",
        };
    }
  });

  const exampleRouteGrades = ["6a", "7a", "8a"];
  const exampleBoulderGrades = ["5A", "6A", "7A"];

  function getExampleRouteGrades(scale: Scale) {
    return exampleRouteGrades.map((g) => convertGrade(g, french, scale)).join(", ");
  }

  function getExampleBoulderGrades(scale: Scale) {
    return exampleBoulderGrades.map((g) => convertGrade(g, french, scale)).join(", ");
  }

  const tooltipInfo = BitsUiTooltip.createTether<Scale>();
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline" size="icon-lg" aria-label="Settings">
        <SettingsIcon />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content class="w-56">
    <DropdownMenu.Label>Accounts</DropdownMenu.Label>
    <DropdownMenu.Group>
      <DropdownMenu.Item onclick={osmButton.action}>
        {osmButton.label}
      </DropdownMenu.Item>
    </DropdownMenu.Group>
    <DropdownMenu.Separator />
    <DropdownMenu.Label>Settings</DropdownMenu.Label>
    <DropdownMenu.Group>
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger>Theme</DropdownMenu.SubTrigger>
        <DropdownMenu.SubContent>
          <DropdownMenu.RadioGroup bind:value={() => userPrefersMode.current, setMode}>
            <DropdownMenu.RadioItem value="light">Light</DropdownMenu.RadioItem>
            <DropdownMenu.RadioItem value="dark">Dark</DropdownMenu.RadioItem>
            <DropdownMenu.RadioItem value="system">System</DropdownMenu.RadioItem>
          </DropdownMenu.RadioGroup>
        </DropdownMenu.SubContent>
      </DropdownMenu.Sub>
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger>Route Grading Scale</DropdownMenu.SubTrigger>
        {@render preferredScaleMenu(
          getPreferredRouteGradingScale(),
          allRouteScales,
          getExampleRouteGrades,
        )}
      </DropdownMenu.Sub>
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger>Boulder Grading Scale</DropdownMenu.SubTrigger>
        {@render preferredScaleMenu(
          getPreferredBoulderGradingScale(),
          allBoulderScales,
          getExampleBoulderGrades,
        )}
      </DropdownMenu.Sub>
    </DropdownMenu.Group>
  </DropdownMenu.Content>
</DropdownMenu.Root>

{#snippet preferredScaleMenu<T extends ScaleId>(
  preferredScale: FromCurrent<"local" | T>,
  scales: Scale<T>[],
  getExampleGrades: (s: Scale) => string,
)}
  <DropdownMenu.SubContent>
    <DropdownMenu.RadioGroup bind:value={preferredScale.current}>
      <DropdownMenu.RadioItem value="local">Local</DropdownMenu.RadioItem>
      <Tooltip.Root tether={tooltipInfo}>
        {#snippet children({ payload })}
          {const p = payload as Scale | null}
          {#each scales as s}
            <Tooltip.Trigger payload={s}>
              {#snippet child({ props })}
                <DropdownMenu.RadioItem value={s.id} {...props}>
                  {s.id}
                </DropdownMenu.RadioItem>
              {/snippet}
            </Tooltip.Trigger>
          {/each}
          <Tooltip.Content side="left" align="center" class="block">
            <h3 class="font-bold text-base text-pretty">{p?.name}</h3>
            <p class="my-1">{p?.description}</p>
            <i>Examples: {p ? getExampleGrades(p) : ""}</i>
          </Tooltip.Content>
        {/snippet}
      </Tooltip.Root>
    </DropdownMenu.RadioGroup>
  </DropdownMenu.SubContent>
{/snippet}
