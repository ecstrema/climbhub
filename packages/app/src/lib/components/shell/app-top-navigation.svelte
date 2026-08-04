<script lang="ts">
  import * as Breadcrumb from "@/ui/breadcrumb";
  import * as DropdownMenu from "@/ui/dropdown-menu";
  import { Button } from "@/ui/button";

  import { getName } from "$lib/data";
  import { resolve } from "$app/paths";
  import type { BreadcrumbSegment } from "$lib/types";

  import { IsMobile } from "$lib/hooks/is-mobile.svelte";
  import { getBreadcrumbs } from "@/shell/providers";

  const breadcrumbsProvider = getBreadcrumbs();

  const breadcrumbs = $derived.by(() => breadcrumbsProvider.current);

  const isMobile = new IsMobile();
</script>

{#if breadcrumbs.length > 0}
  <Breadcrumb.Root>
    {@const lastElement = breadcrumbs.at(-1)!}
    <Breadcrumb.List>
      {@const breadcrumbSegments = isMobile.current ? breadcrumbs.slice(-2) : breadcrumbs}

      <!-- On mobile, display only the last breadcrumb with a back chevron -->
      {#if isMobile.current && breadcrumbs.length > 1}
        <Breadcrumb.Item>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button {...props} variant="ghost" size="icon-lg" aria-label="Settings">
                  <Breadcrumb.Ellipsis />
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Group>
                {#each breadcrumbs.slice(0, -2) as breadcrumb (breadcrumb.slug)}
                  <DropdownMenu.Item>
                    <a
                      href={resolve("/world/[...slug]", { slug: breadcrumb.slug })}
                      class="size-full"
                    >
                      {getName(breadcrumb.data)}
                    </a>
                  </DropdownMenu.Item>
                {/each}
              </DropdownMenu.Group>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </Breadcrumb.Item>
        <Breadcrumb.Separator />
      {/if}

      {#each breadcrumbSegments as breadcrumb (breadcrumb.slug)}
        {@render breadcrumbFromDataJSON(breadcrumb, lastElement)}
      {/each}
    </Breadcrumb.List>
  </Breadcrumb.Root>
{/if}

{#snippet breadcrumbFromDataJSON(breadcrumb: BreadcrumbSegment, lastElement: BreadcrumbSegment)}
  {@const name = getName(breadcrumb.data)}

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
