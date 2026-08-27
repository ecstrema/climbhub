<script lang="ts">
  import { getCurrentNode } from "@/shell/providers";
  import EditableTextarea from "./editable-textarea.svelte";

  const node = $derived(getCurrentNode().current.own);
</script>

{#if node.type !== "geographic" && node.tags}
  <EditableTextarea
    bind:value={node.tags.description}
    placeholder="Enter description..."
    class="text-sm"
    maxlength={255}
  />
{/if}
