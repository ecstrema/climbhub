<script lang="ts">
  import * as Breadcrumb from "#components/ui/breadcrumb";
  import * as DropdownMenu from "#components/ui/dropdown-menu";
  import { Button } from "#components/ui/button/index.js";

  import { getName } from "#lib/data/parse/data.js";
  import { resolve } from "$app/paths";
  import type { BreadcrumbSegment } from "#lib/types.js";
  import { onMount, settled } from "svelte";
  import { getAppState } from "#lib/data/app-state.js";

  const appState = getAppState();
  const breadcrumbs = $derived.by(() => appState.breadcrumbs.items);

  $effect(() => {
    if (breadcrumbs.length > 0) {
      recomputeHiddenCount();
    }
  });

  let rootElement: HTMLElement | null = $state(null);
  let hidden = $state(0);

  async function recomputeHiddenCount() {
    if (!rootElement) return;
    hidden = 0;
    await settled();
    await computeHiddenCount();
  }

  async function computeHiddenCount() {
    if (!rootElement) return;

    const domRect = rootElement.getBoundingClientRect();
    if (domRect.height > 32 && hidden < 32) {
      hidden++;
      await settled();
      await computeHiddenCount();
    }
  }

  onMount(() => {
    if (!rootElement) return;

    let previousWidth = 0;
    const ro = new ResizeObserver((entry) => {
      const w = entry[0]?.contentRect.width;
      if (!w) return;

      const widthChanged = w !== previousWidth;
      previousWidth = w;
      if (widthChanged) {
        ro.unobserve(rootElement!);
        recomputeHiddenCount();
        ro.observe(rootElement!);
      }
    });
    ro.observe(rootElement);

    return () => ro.disconnect();
  });

  const shownBreadcrumbSegments = $derived.by(() => {
    return breadcrumbs.slice(hidden);
  });
</script>

{#if breadcrumbs.length > 0}
  <Breadcrumb.Root bind:ref={rootElement} class="w-full">
    {const lastElement = $derived(breadcrumbs.at(-1)!)}
    <Breadcrumb.List>
      <!-- display only the last breadcrumb with an ellipsis for parents -->
      {const ellipsisItems = $derived(breadcrumbs.slice(0, hidden))}
      {#if ellipsisItems.length > 0}
        <Breadcrumb.Item>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button {...props} variant="ghost" size="icon-sm" aria-label="Settings">
                  <Breadcrumb.Ellipsis />
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Group>
                {#each ellipsisItems as breadcrumb (breadcrumb.slug)}
                  <DropdownMenu.Item>
                    <a href={resolve("/world/[...slug]", { slug: breadcrumb.slug })} class="size-full">
                      {breadcrumb.data ? getName(breadcrumb.data.feature) : ""}
                    </a>
                  </DropdownMenu.Item>
                {/each}
              </DropdownMenu.Group>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </Breadcrumb.Item>
        <Breadcrumb.Separator />
      {/if}

      {#each shownBreadcrumbSegments as breadcrumb (breadcrumb.slug)}
        {@render breadcrumbFromDataJSON(breadcrumb, lastElement)}
      {/each}
    </Breadcrumb.List>
  </Breadcrumb.Root>
{/if}

{#snippet breadcrumbFromDataJSON(breadcrumb: BreadcrumbSegment, lastElement: BreadcrumbSegment)}
  {const name = $derived(breadcrumb.data ? getName(breadcrumb.data.feature) : "")}

  <Breadcrumb.Item>
    {#if breadcrumb === lastElement}
      <Breadcrumb.Page>{name}</Breadcrumb.Page>
    {:else}
      <Breadcrumb.Link
        href={resolve("/world/[...slug]", {
          slug: breadcrumb.slug,
        })}
      >
        {name}
      </Breadcrumb.Link>
    {/if}
  </Breadcrumb.Item>
  {#if breadcrumb !== lastElement}
    <Breadcrumb.Separator />
  {/if}
{/snippet}
