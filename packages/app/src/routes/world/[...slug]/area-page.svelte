<script lang="ts">
  import { resolve } from "$app/paths";
  import { getName } from "$lib/data";
  import EditableDescription from "@/editable/editable-description.svelte";
  import EditableName from "@/editable/editable-name.svelte";
  import { getCurrentNode } from "@/shell/providers";
  import * as Table from "@/ui/table";
  import ChildrenTable from "./children-table.svelte";
  import EditableTags from "../../../lib/components/editable/editable-tags.svelte";

  const currentNodeProvider = $derived(getCurrentNode().current);
  const currentNode = $derived(currentNodeProvider.own);
</script>

<EditableName />
<EditableDescription />

{#if currentNodeProvider.stats?.totalRoutes}
  <p>{currentNodeProvider.stats?.totalRoutes}</p>
{/if}

<ChildrenTable />
<EditableTags />
