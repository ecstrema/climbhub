import { error } from "@sveltejs/kit"
import { type } from "arktype"
import { AreaFrontmatter, RouteFrontmatter, type AreaNode, type RouteNode } from "$lib/types"
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
    // 1. Grab the processed modules
    // Note: No need for ?raw or manual parsing; the plugin handles it.
    const modules = import.meta.glob('/src/data/routes/**/*.md', {
        eager: true
    }) as Record<string, { html: string; frontmatter: Record<string, unknown> }>;

    const routePath = `/src/data/routes/${params.slug}.md`;
    const indexPath = `/src/data/routes/${params.slug}/index.md`;

    let module = modules[routePath];
    let kind: "route" | "area" = "route";

    // 2. Determine if it's a Route, an Area (index.md), or just a Folder
    if (!module) {
        if (modules[indexPath]) {
            module = modules[indexPath];
            kind = "area";
        } else {
            // Check if it's a folder that exists but has no index.md
            // We verify if any known markdown file exists inside this path
            const folderExists = Object.keys(modules).some(key =>
                key.startsWith(`/src/data/routes/${params.slug}/`)
            );

            if (folderExists) {
                return {
                    content: "", // No content because there's no index.md
                    treeNode: {
                        kind: "area",
                        name: params.slug.split("/").pop()?.replaceAll("_", " ") || "",
                        link: `/routes/${params.slug}`
                    } as AreaNode
                };
            }

            throw error(404, `Route or Area ${params.slug} not found`);
        }
    }

    // 3. Validate with Arktype
    const { html, frontmatter } = module;
    const frontmatterData = kind === "area"
        ? AreaFrontmatter(frontmatter)
        : RouteFrontmatter(frontmatter);

    // 4. Construct the node
    const treeNode: any = {
        kind,
        name: params.slug.split("/").pop()?.replaceAll("_", " ") || "",
        link: `/routes/${params.slug}`,
    };

    if (frontmatterData instanceof type.errors) {
        treeNode.errors = frontmatterData;
    } else {
        Object.assign(treeNode, frontmatterData);
    }

    return {
        content: html,
        treeNode
    };
};
