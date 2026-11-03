<script lang="ts">
  import type { Snippet } from "svelte";
  import { PersistentState } from "@friendofsvelte/state";

  import { setPreferredRouteGradingScale, setPreferredBoulderGradingScale } from "./settings.svelte";
  import type { BoulderScaleId, RouteScaleId } from "@climbhub/holy-grade";

  const preferredRouteGradingScale = new PersistentState<RouteScaleId | "local">("preferredRouteGradingScale", "local");

  const preferredBoulderGradingScale = new PersistentState<BoulderScaleId | "local">(
    "preferredBoulderGradingScale",
    "local",
  );

  setPreferredRouteGradingScale(preferredRouteGradingScale);
  setPreferredBoulderGradingScale(preferredBoulderGradingScale);

  const {
    children,
  }: {
    children: Snippet;
  } = $props();
</script>

{@render children?.()}
