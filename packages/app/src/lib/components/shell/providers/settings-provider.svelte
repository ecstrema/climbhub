<script lang="ts">
  import type { Snippet } from "svelte";
  import { PersistentState } from "@friendofsvelte/state";

  import { setPreferredGradeScale } from "./settings.svelte";
  import type { ScaleName } from "holy-grade";

  const preferredGradeScale = new PersistentState<ScaleName | "local">(
    "preferredGradeScale",
    "local",
  );

  setPreferredGradeScale(preferredGradeScale);

  const {
    children,
  }: {
    children: Snippet;
  } = $props();
</script>

{@render children?.()}
