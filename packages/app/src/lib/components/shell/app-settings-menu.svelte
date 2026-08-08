<script lang="ts">
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import * as DropdownMenu from "@/ui/dropdown-menu";
  import { Button } from "@/ui/button";
  import * as Tooltip from "@/ui/tooltip/index.js";

  import { setMode, userPrefersMode } from "mode-watcher";

  import {
    getOsmUser,
    getPreferredRouteGradingScale,
    getPreferredBoulderGradingScale,
  } from "@/shell/providers";
  import {
    allBoulderScales,
    french,
    convertGrade,
    type Scale,
    allRouteScales,
    type ScaleId,
  } from "holy-grade";
  import type { FromCurrent } from "./providers/types";

  const user = getOsmUser();

  const osmButton = $derived.by(() => {
    switch (user.loggedIn) {
      case null:
        return {
          action: () => {},
          label: "OSM loading",
        };
      case true:
        return {
          action: () => user.logout(),
          label: "Logout OSM",
        };
      case false:
        return {
          action: () => user.login(),
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
      {#each scales as s}
        <DropdownMenu.RadioItem value={s.id}>
          <Tooltip.Root>
            <Tooltip.Trigger>
              <div class="w-full">{s.id}</div>
            </Tooltip.Trigger>
            <Tooltip.Content side="left" align="center">
              <div class="prose prose-sm">
                <h3>{s.name}</h3>
                <p>{s.description}</p>
                <p class="italic">Examples: {getExampleGrades(s)}</p>
              </div>
            </Tooltip.Content>
          </Tooltip.Root>
        </DropdownMenu.RadioItem>
      {/each}
    </DropdownMenu.RadioGroup>
  </DropdownMenu.SubContent>
{/snippet}
