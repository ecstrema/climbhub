<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { HTMLTextareaAttributes } from "svelte/elements";
  import EditableTooltip from "./editable-tooltip.svelte";
  import { getAppState } from "$lib/data/app-state";

  const appState = getAppState();

  let {
    value = $bindable(),
    class: className,
    singleLine = false,
    onfocus,
    onblur,
    onkeydown,
    onpaste,
    ...props
  }: HTMLTextareaAttributes & {
    /**
     * Keep the value on a single line: Enter commits the edit, and line breaks are removed when pasting.
     * Still a textarea rather than an input, since some password managers scan the page on every
     * input focus, which causes a huge input lag.
     */
    singleLine?: boolean;
  } = $props();

  function handleFocus(e: FocusEvent & { currentTarget: HTMLTextAreaElement }) {
    // Every keystroke is applied live, but undone at once
    appState.undoStack.beginGroup();
    onfocus?.(e);
  }

  function handleBlur(e: FocusEvent & { currentTarget: HTMLTextAreaElement }) {
    appState.undoStack.endGroup();
    onblur?.(e);
  }

  function handleKeydown(e: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) {
    if (singleLine && e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
    onkeydown?.(e);
  }

  function handlePaste(e: ClipboardEvent & { currentTarget: HTMLTextAreaElement }) {
    const text = e.clipboardData?.getData("text/plain");
    if (singleLine && text && /[\r\n]/.test(text)) {
      e.preventDefault();
      const textarea = e.currentTarget;
      textarea.setRangeText(text.replace(/\s*[\r\n]+\s*/g, " "), textarea.selectionStart, textarea.selectionEnd, "end");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }
    onpaste?.(e);
  }
</script>

<EditableTooltip>
  {#snippet children(tooltipProps)}
    <textarea
      class={cn(
        "bg-none border-none p-0 m-0 outline-none appearance-none focus:outline-accent-foreground field-sizing-content resize-none self-start",
        singleLine && "whitespace-nowrap overflow-hidden",
        className,
      )}
      bind:value
      disabled={!appState.osmUser.loggedIn}
      rows={singleLine ? 1 : undefined}
      enterkeyhint={singleLine ? "done" : undefined}
      {...tooltipProps}
      {...props}
      onfocus={handleFocus}
      onblur={handleBlur}
      onkeydown={handleKeydown}
      onpaste={handlePaste}></textarea>
  {/snippet}
</EditableTooltip>
