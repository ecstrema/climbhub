<script lang="ts">
  import { getProcessedData } from "@/shell/providers/app-data.svelte";
  import ChildrenTable from "./children-table.svelte";
  const data = $derived(getProcessedData().current);
</script>

<h1 class="text-2xl font-semibold">
  {data?.name || "No Name"}
</h1>

<ChildrenTable />
