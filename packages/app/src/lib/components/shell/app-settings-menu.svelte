<script lang="ts">
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import * as DropdownMenu from "@/ui/dropdown-menu";
  import { Button } from "@/ui/button";
  import { setMode, userPrefersMode } from "mode-watcher";

  import { getOsmUser, getPreferredGradeScale } from "@/shell/providers";
  import { allScales, convertGrade, French, type Scale, type ScaleName } from "holy-grade";

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
    return exampleRouteGrades.map((g) => convertGrade(g, French, scale)).join(", ");
  }

  function getExampleBoulderGrades(scale: Scale) {
    return exampleBoulderGrades.map((g) => convertGrade(g, French, scale)).join(", ");
  }

  const preferredGradeScale = $derived.by(() => getPreferredGradeScale());
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
        <DropdownMenu.SubContent>
          <DropdownMenu.RadioGroup bind:value={preferredGradeScale.current}>
            <DropdownMenu.RadioItem value="local">Local</DropdownMenu.RadioItem>
            <DropdownMenu.RadioItem value="YDS">YDS</DropdownMenu.RadioItem>
            <DropdownMenu.RadioItem value="UIAA">UIAA</DropdownMenu.RadioItem>
            <DropdownMenu.RadioItem value="French">French</DropdownMenu.RadioItem>
          </DropdownMenu.RadioGroup>
        </DropdownMenu.SubContent>
      </DropdownMenu.Sub>
    </DropdownMenu.Group>
  </DropdownMenu.Content>
</DropdownMenu.Root>
