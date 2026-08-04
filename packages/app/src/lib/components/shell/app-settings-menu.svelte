<script lang="ts">
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import * as DropdownMenu from "@/ui/dropdown-menu";
  import { Button } from "@/ui/button";
  import { setMode, userPrefersMode } from "mode-watcher";

  import { getOsmUser } from "@/shell/providers";

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
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline" size="icon-lg" aria-label="Settings">
        <SettingsIcon />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content>
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
    </DropdownMenu.Group>
  </DropdownMenu.Content>
</DropdownMenu.Root>
