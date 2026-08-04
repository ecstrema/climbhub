<script lang="ts">
  import type { Snippet } from "svelte";
  import { setPreferredGradeScale } from "./grade.svelte";

  import type { GradeScalesTypes } from "@openbeta/sandbag";

  const preferredGradeScale = $state<GradeScalesTypes>("french");

  setPreferredGradeScale({
    get current() {
      return preferredGradeScale;
    },
  });

  const {
    children,
  }: {
    children: Snippet;
  } = $props();
</script>

{@render children?.()}
