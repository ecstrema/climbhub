<script lang="ts">
  import { getCurrentNode } from "@/shell/providers";
  import EditableText from "./editable-text.svelte";

  const node = $derived(getCurrentNode().current.own);
</script>

{#if node.type !== "geographic" && node.tags}
  <EditableText bind:value={node.tags.name} placeholder="Enter name..." class="text-2xl" />
{/if}
