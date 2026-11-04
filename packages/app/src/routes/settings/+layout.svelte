<script lang="ts">
  import type { Snippet } from "svelte";
  import SettingsProvider from "#lib/components/shell/providers/settings-provider.svelte";

  const { children }: { children: Snippet } = $props();
</script>

<SettingsProvider>
  {@render children()}
</SettingsProvider>
