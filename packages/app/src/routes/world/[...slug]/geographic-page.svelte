<script lang="ts">
  import type { DataTree } from "$lib/types";
  import ChildrenTable from "./children-table.svelte";
  import type { GeographicFolderElement } from "@climbhub/climbing-data-gen";

  let {
    item = $bindable(),
  }: {
    item: DataTree<GeographicFolderElement>;
  } = $props();
</script>

<h1 class="text-2xl font-semibold">
  {item.feature.name || "No Name"}
  <!-- TODO: add an icon to indicate that no name has been given to this. It is an error and should be fixed directly in the code -->
</h1>

<ChildrenTable bind:item />
