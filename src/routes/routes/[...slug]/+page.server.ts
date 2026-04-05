import { error } from "@sveltejs/kit"
import { access } from "fs/promises"
import { type } from "arktype"

import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkRehype from 'remark-rehype'
import { read } from 'to-vfile'
import { unified } from 'unified'

import type { PageServerLoad } from './$types';
import { getFrontmatter } from "../frontmatter"
import { AreaFrontmatter, RouteFrontmatter, type AreaNode, type RouteNode, type TreeNode } from "$lib/types"

export const load: PageServerLoad = async ({ params }) => {
  let kind = "route" as "route" | "area"
  let path = `src/data/routes/${params.slug}.md`
  try {
    await access(path)
  } catch (err) {
    try {
      path = `src/data/routes/${params.slug}/index.md`
      kind = "area"
      await access(path)
    } catch (err) {
      throw error(404, "Route or Area not found")
    }
  }

  const file = await unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(getFrontmatter)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(await read(path))


  const data: TreeNode = {
    kind,
    name: params.slug.split("/").pop()?.replaceAll("_", " ") || "",
  }
  const matter = kind === "area" ? AreaFrontmatter(file.data.matter) : RouteFrontmatter(file.data.matter)

  if (matter instanceof type.errors) {
    data.errors = matter
  } else {
    Object.assign(data, matter)
  }

  return {
    content: String(file),
    treeNode: data
  }
}
