<script lang="ts">
	import { resolve } from "$app/paths";

	import * as Collapsible from "$lib/components/ui/collapsible/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import type { AreaNode, TreeNode } from "$lib/types";
	import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
	import FileIcon from "@lucide/svelte/icons/file";
	import FolderIcon from "@lucide/svelte/icons/folder";
	import type { ComponentProps } from "svelte";

	interface AppSidebarProps {
		dataTree: AreaNode;
		breadcrumbs?: { name: string; link: string }[];
	}

	let {
		ref = $bindable(null),
		dataTree,
		breadcrumbs = [],
		...restProps
	}: ComponentProps<typeof Sidebar.Root> & AppSidebarProps = $props();
</script>

<Sidebar.Root bind:ref {...restProps}>
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Areas</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#if dataTree.children}
						{#each Object.entries(dataTree.children) as [key, value] (key)}
							{@render Tree(value)}
						{/each}
					{/if}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>
	<Sidebar.Rail />
</Sidebar.Root>

{#snippet Tree(item: TreeNode)}
	{@const name = item.name}
	{#if item.kind === "route"}
		<Sidebar.MenuButton
			isActive={name === "button.svelte"}
			class="data-[active=true]:bg-transparent"
		>
			<FileIcon />
			<a href={resolve(item.link as any)}>{name}</a>
			<div class="grow"></div>
			{item.grade}
		</Sidebar.MenuButton>
	{:else}
		<Sidebar.MenuItem>
			<Collapsible.Root
				class="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
				open={breadcrumbs.map((b) => b.link).includes(item.link || "")}
			>
				<Collapsible.Trigger>
					{#snippet child({ props })}
						<Sidebar.MenuButton {...props}>
							<ChevronRightIcon class="transition-transform" />
							<FolderIcon />
							<a href={resolve(item.link as any)}>{name}</a>
						</Sidebar.MenuButton>
					{/snippet}
				</Collapsible.Trigger>
				<Collapsible.Content>
					<Sidebar.MenuSub>
						{#if item.children}
							{#each Object.entries(item.children) as [key, child] (key)}
								{@render Tree(child)}
							{/each}
						{/if}
					</Sidebar.MenuSub>
				</Collapsible.Content>
			</Collapsible.Root>
		</Sidebar.MenuItem>
	{/if}
{/snippet}
