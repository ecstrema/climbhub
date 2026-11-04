<script lang="ts">
  import UserRoundIcon from "@lucide/svelte/icons/user-round";
  import { resolve } from "$app/paths";
  import { Button } from "#components/ui/button/index.js";
</script>

<Button href={resolve("/settings")} variant="outline" size="icon-lg" aria-label="Settings">
  <UserRoundIcon />
</Button>
