<script lang="ts">
  import * as Table from "#components/ui/table/index.js";
  import EditableTextarea from "./editable-textarea.svelte";
  import { featureToTypeOSM, processedTags } from "#lib/data/parse/osm-tags.js";
  import type { Key, OsmFeature, Tags } from "osm-api";
  import { cn } from "#lib/utils.js";
  import { getAppState } from "#lib/data/app-state.js";
  import { Button } from "#components/ui/button/index.js";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import PlusIcon from "@lucide/svelte/icons/plus";

  const {
    feature,
    featureSlug,
  }: {
    feature: OsmFeature;
    featureSlug: string;
  } = $props();

  const appState = getAppState();
  type TagKey = Key;

  const tags = $derived.by(() => feature.tags || {});

  const { knownTags, invalidTags, unknownTags } = $derived.by(() => {
    const knownTags: TagKey[] = [];
    const unknownTags: TagKey[] = [];
    const invalidTags: TagKey[] = [];

    const featureType = featureToTypeOSM(feature);
    if (!featureType) {
      return { knownTags, invalidTags, unknownTags: Object.keys(tags) as TagKey[] };
    }

    const processedTagsForElement = processedTags[featureType];

    for (let k of Object.keys(tags)) {
      const key = k as TagKey;

      const validator = processedTagsForElement[key];
      if (!validator) {
        unknownTags.push(key);
        continue;
      }
      if (validator(tags[key]!)) {
        knownTags.push(key);
      } else {
        invalidTags.push(key);
      }
    }
    return { knownTags, invalidTags, unknownTags };
  });

  let newTag = $state<{ key: string; value: string } | undefined>();
  const newKey = $derived(newTag?.key.trim() ?? "");
  const newKeyError = $derived(
    newKey.length > 255 ? "Keys are limited to 255 characters" : newKey in tags ? "This tag already exists" : undefined,
  );

  function addTag() {
    if (!newTag || !newKey || newKeyError) return;
    appState.setTag(featureSlug, newKey as TagKey, newTag.value);
    newTag = undefined;
  }

  function onNewTagKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      addTag();
    } else if (event.key === "Escape") {
      newTag = undefined;
    }
  }

  const inputClass =
    "w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50";
</script>

{#if appState.osmUser.loggedIn || knownTags.length > 0 || invalidTags.length > 0 || unknownTags.length > 0}
  <h2 class="text-lg font-semibold">OpenStreetMap Data</h2>

  <Table.Root class="max-w-96">
    <Table.Header>
      <Table.Row>
        <Table.Head>Tag</Table.Head>
        <Table.Head>Value</Table.Head>
        {#if appState.osmUser.loggedIn}
          <Table.Head></Table.Head>
        {/if}
      </Table.Row>
    </Table.Header>
    <Table.Body class="font-medium">
      {@render showTags(unknownTags, "Unknown tags", "")}
      {@render showTags(invalidTags, "Invalid tags", "text-destructive")}
      {@render showTags(knownTags, "Known tags", "text-muted-foreground")}
      {#if appState.osmUser.loggedIn}
        {@render showNewTag()}
      {/if}
    </Table.Body>
  </Table.Root>

  {#if appState.osmUser.loggedIn && !newTag}
    <Button
      variant="outline"
      size="xs"
      class="self-start font-normal"
      onclick={() => (newTag = { key: "", value: "" })}
    >
      <PlusIcon />
      New tag
    </Button>
  {/if}
{/if}

{#snippet showTags(specialTags: TagKey[], title: string, className: string)}
  {#if specialTags.length > 0}
    <Table.Row
      class={cn(
        "font-bold text-center border-b-3 [border-bottom-style:double] border-b-muted-foreground h-12",
        className,
      )}
    >
      <Table.Cell colspan={appState.osmUser.loggedIn ? 3 : 2}>{title}</Table.Cell>
    </Table.Row>
  {/if}
  {#each specialTags as key (key)}
    <Table.Row class={className}>
      <Table.Cell>{key}</Table.Cell>
      <Table.Cell>
        <EditableTextarea bind:value={() => tags[key], (v) => appState.setTag(featureSlug, key, v)} />
      </Table.Cell>
      {#if appState.osmUser.loggedIn}
        <Table.Cell>
          <Button
            size="icon-sm"
            variant="ghost"
            title="Delete tag {key}"
            onclick={() => appState.deleteTag(featureSlug, key)}
          >
            <Trash2Icon />
          </Button>
        </Table.Cell>
      {/if}
    </Table.Row>
  {/each}
{/snippet}

{#snippet showNewTag()}
  {#if newTag}
    <Table.Row>
      <Table.Cell class="align-top">
        <!-- svelte-ignore a11y_autofocus -->
        <EditableTextarea
          singleLine
          class={inputClass}
          placeholder="Key"
          maxlength={255}
          autofocus
          bind:value={newTag.key}
          onkeydown={onNewTagKeydown}
        />
        {#if newKeyError}
          <p class="mt-1 text-xs text-destructive">{newKeyError}</p>
        {/if}
      </Table.Cell>
      <Table.Cell class="align-top">
        <EditableTextarea
          singleLine
          class={inputClass}
          placeholder="Value"
          maxlength={255}
          bind:value={newTag.value}
          onkeydown={onNewTagKeydown}
        />
      </Table.Cell>
      <Table.Cell class="align-top">
        <div class="flex gap-1">
          <Button size="xs" disabled={!newKey || !!newKeyError} onclick={addTag}>Add</Button>
          <Button size="xs" variant="ghost" onclick={() => (newTag = undefined)}>Cancel</Button>
        </div>
      </Table.Cell>
    </Table.Row>
  {/if}
{/snippet}
