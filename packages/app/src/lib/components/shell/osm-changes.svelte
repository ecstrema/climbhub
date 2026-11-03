<script lang="ts">
  import UploadIcon from "@lucide/svelte/icons/upload";
  import DeleteIcon from "@lucide/svelte/icons/delete";
  import { Button } from "#components/ui/button/index.js";
  import * as Dialog from "#components/ui/dialog";
  import { getNameOSM } from "#lib/data/parse/osm-tags.js";

  import { Progress } from "#components/ui/progress/index.js";
  import { getAppState } from "#lib/data/app-state.js";

  const appState = getAppState();
  let open = $state(false);
  let comment = $state("");
  let error = $state<string>();

  const detailedChanges = $derived(appState.osmUser.getDetailedChanges());

  $effect(() => {
    if (open) {
      // Compute an intelligent default comment
      if (detailedChanges.size === 1) {
        const [slug, diff] = detailedChanges.entries().next().value!;

        if (diff === "created") {
          comment = `created ${slug}`;
        } else if (diff === "deleted") {
          comment = `Deleted ${slug}`;
        } else {
          comment = `Edited ${slug}`;
        }
      } else {
        comment = `${appState.osmUser.changes.size} features modified`;
      }
    }
  });

  async function submit() {
    error = undefined;
    try {
      await appState.osmUser.submitChanges(comment);
      comment = "";
      open = false;
    } catch (reason) {
      error = reason instanceof Error ? reason.message : "Could not submit changes";
    }
  }

  $effect(() => {
    if (appState.osmUser.changes.size === 0) open = false;
  });
</script>

{#if appState.osmUser.changes.size}
  <Dialog.Root bind:open>
    <Dialog.DialogTrigger>
      <Button
        class="fixed bottom-5 right-5 z-20 shadow-lg"
        aria-label="Review pending OpenStreetMap changes to submit them"
      >
        <UploadIcon />
        <span class="text-xs">{appState.osmUser.changes.size}</span>
      </Button>
    </Dialog.DialogTrigger>
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title>OpenStreetMap changes</Dialog.Title>
        <Dialog.Description>
          <!-- TODO: use an actual translation library for handling plurals: wuchale -->
          {appState.osmUser.changes.size} feature{appState.osmUser.changes.size === 1 ? "" : "s"} modified
        </Dialog.Description>
      </Dialog.Header>
      <ul class="my-4 space-y-3 text-sm">
        {#each appState.osmUser.changes as [slug, changedFeature] (slug)}
          {#if changedFeature}
            <li>
              <strong>{slug}</strong>
              <span>
                - {getNameOSM(changedFeature.final?.tags ?? changedFeature.initial?.tags ?? {}) || "Unnamed feature"}
              </span>
              <Button variant="ghost" size="icon" class="ml-2 p-1" onclick={() => appState.resetFeature(slug)}>
                <DeleteIcon />
              </Button>
            </li>
          {:else}
            <span>Feature {slug} was deleted</span>
          {/if}
        {/each}
      </ul>
      <label class="block text-sm font-medium" for="osm-comment">Comment (optional)</label>
      <textarea
        id="osm-comment"
        bind:value={comment}
        placeholder="Leave a comment"
        class="mt-2 min-h-20 w-full rounded-md border bg-transparent p-2"
        maxlength="255"></textarea>

      {#if error}<p class="mt-2 text-sm text-destructive">{error}</p>{/if}
      <Dialog.Footer>
        <Dialog.Close>
          {#snippet child({ props })}
            <Button {...props} variant="outline">Cancel</Button>
          {/snippet}
        </Dialog.Close>
        <Button onclick={submit} disabled={!!appState.osmUser.submitting || !appState.osmUser.loggedIn}>
          {appState.osmUser.submitting ? "Submitting..." : "Submit changes"}
        </Button>
      </Dialog.Footer>
      {#if appState.osmUser.submitting}
        <Progress class="mt-2" value={appState.osmUser.submitting.step} max={appState.osmUser.submitting.total} />
      {/if}
    </Dialog.Content>
  </Dialog.Root>
{/if}
