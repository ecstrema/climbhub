import { AreaFrontmatter, RouteFrontmatter, type AreaNode, type RouteNode } from "$lib/types"
import { readdir, readFile } from "fs/promises"
import { join } from "path"

import remarkFrontmatter from 'remark-frontmatter'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'

import { type } from "arktype"

import type { LayoutServerLoad } from "./$types"
import { getFrontmatter } from "./frontmatter"

export const load: LayoutServerLoad = async () => {
  async function walkDirectory(dir: string, parent: AreaNode) {
    const files = await readdir(dir, { withFileTypes: true });
    for (const file of files) {
      const res = join(dir, file.name);

      const name = file.name.replaceAll("_", " ").replace(".md", "")
      const link = res.replaceAll("\\", "/").replace("src/data/routes/", "/routes/").replace(".md", "")
      if (file.isDirectory()) {
        const areaNode: AreaNode = {
          kind: "area",
          name,
          link,
        }

        if (!parent.children) {
          parent.children = {}
        }

        parent.children[file.name] = areaNode;
        await walkDirectory(res, areaNode);
      } else {
        const routeNode: RouteNode = {
          kind: "route",
          name,
          link,
        }

        if (file.name !== "index.md") {
          if (!parent.children) {
            parent.children = {}
          }
          parent.children[file.name] = routeNode;
        }

        // Get the frontmatter from the file
        const parsedFile = await unified()
          .use(remarkParse)
          .use(remarkStringify)
          .use(remarkFrontmatter)
          .use(getFrontmatter)
          .process(await readFile(res, "utf8"))

        if (!parsedFile.data.matter) {
          continue
        }
        let data = file.name === "index.md"
          ? AreaFrontmatter(parsedFile.data.matter)
          : RouteFrontmatter(parsedFile.data.matter)

        if (data instanceof type.errors) {
          routeNode.errors = data
          continue
        }

        Object.assign(routeNode, data)
      }
    }
  }

  const routeTree: AreaNode = {
    kind: "area",
    name: "World",
    children: {},
    link: "/routes/"
  }
  await walkDirectory("src/data/routes/", routeTree)

  return {
    routeTree
  }
}
