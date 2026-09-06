<script lang="ts">
  import UploadIcon from "@lucide/svelte/icons/upload";
  import { getOsmUser } from "./providers";
  import { Button } from "@/ui/button";
  import * as Dialog from "@/ui/dialog";
  import { getNameOSM } from "$lib/osm-tags";

  import { Progress } from "@/ui/progress";

  const osmUser = getOsmUser();

  let open = $state(false);
  let comment = $state("");
  let error = $state<string>();

  $effect(() => {
    if (open) {
      // Compute an intelligent default comment
      if (osmUser.changeCount === 1) {
        const [id, changedFeature] = Object.entries(osmUser.changes)[0]!;
        if (changedFeature) {
          const name = getNameOSM(changedFeature.tags ?? {});
          comment = `Updated ${name || "feature"} (${id})`;
        } else {
          comment = `Deleted feature ${id}`;
        }
      } else {
        comment = `${osmUser.changeCount} features modified`;
      }
    }
  });

  async function submit() {
    error = undefined;
    try {
      await osmUser.submitChanges(comment);
      comment = "";
      open = false;
    } catch (reason) {
      error = reason instanceof Error ? reason.message : "Could not submit changes";
    }
  }
</script>

{#if osmUser.hasChanges}
  <Dialog.Root bind:open>
    <Dialog.DialogTrigger>
      <Button
        class="fixed bottom-5 right-5 z-20 shadow-lg"
        aria-label="Review pending OpenStreetMap changes to submit them"
      >
        <UploadIcon />
        <span class="text-xs">{osmUser.changeCount}</span>
      </Button>
    </Dialog.DialogTrigger>
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title>OpenStreetMap changes</Dialog.Title>
        <Dialog.Description>
          <!-- TODO: use an actual translation library for handling plurals: wuchale -->
          {osmUser.changeCount} feature{osmUser.changeCount === 1 ? "" : "s"} modified
        </Dialog.Description>
      </Dialog.Header>
      <ul class="my-4 space-y-3 text-sm">
        {#each Object.entries(osmUser.changes) as [id, changedFeature] (id)}
          {#if changedFeature}
            <li>
              <strong>{id}</strong>
              <span> - {getNameOSM(changedFeature.tags ?? {}) || "Unnamed feature"}</span>
              <!-- <pre>{JSON.stringify(changedFeature, undefined, 2)}</pre> -->
              <!-- {#if changedFeature.addedTags.length > 0}
                <div>
                  Added tags: {changedFeature.addedTags
                    .map(([key, value]) => `${key}=${value}`)
                    .join(", ")}
                </div>
              {/if}
              {#if changedFeature.changedTags.length > 0}
                <div>
                  Changed tags: {changedFeature.changedTags
                    .map(([key, oldValue, newValue]) => `${key}: ${oldValue} -> ${newValue}`)
                    .join(", ")}
                </div>
              {/if}
              {#if changedFeature.deletedTags.length > 0}
                <div>
                  Deleted tags: {changedFeature.deletedTags
                    .map(([key, value]) => `${key}=${value}`)
                    .join(", ")}
                </div>
              {/if}
              {#if changedFeature.relationOrderChanged}<div>Relation member order changed</div>{/if} -->
            </li>
          {:else}
            <span>Feature {id} was delete</span>
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
        <Button onclick={submit} disabled={!!osmUser.submitting || !osmUser.loggedIn}>
          {osmUser.submitting ? "Submitting..." : "Submit changes"}
        </Button>
      </Dialog.Footer>
      {#if osmUser.submitting}
        <Progress class="mt-2" value={osmUser.submitting.step} max={osmUser.submitting.total} />
      {/if}
    </Dialog.Content>
  </Dialog.Root>
{/if}
