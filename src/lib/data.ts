import remarkFrontmatter from "remark-frontmatter"
import { reporter } from "vfile-reporter"
import rehypeStringify from "rehype-stringify"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"
import { matter } from "vfile-matter"

export type TreeItemKind = "area" | "route"

export type TreeItem<T extends TreeItemKind = TreeItemKind> = T extends "area"
  ? {
      kind: T
      children: Record<string, TreeItem>
    }
  : {
      kind: T
    }

export type Coordinates = [number, number]

//  Trad, Sport, Boulder, Ice, Mixed, Aid, Alpine,
export type RouteKind = "Trad" | "Sport" | "Boulder" | "Ice" | "Mixed" | "Aid" | "Alpine" | "Toprope"

export interface RouteFrontmatter<T extends RouteKind = RouteKind> {
  routeKind?: T
  name?: string
  grade?: string
  height?: string
  description?: string
  protection?: string
  coordinates?: Coordinates
}

export interface AreaFrontmatter {
  name?: string
  coordinates?: Coordinates
  description?: string
}

export interface ItemMetaData {
  link: string
  errors?: string
}

export type RouteNode = RouteFrontmatter & TreeItem<"route"> & ItemMetaData
export type AreaNode = AreaFrontmatter & TreeItem<"area"> & ItemMetaData

export type TreeNode = RouteNode | AreaNode

export function sanitizeFilename(filename: string): string {
  return filename.replaceAll(/_/g, " ")
}

export const allRoutes = import.meta.glob("/src/data/routes/**/*.md", { query: "raw" })

// I love pronouncing this out loud
export const routeRoot: AreaNode = {
  kind: "area",
  link: "/routes",
  name: "Routes",
  children: {},
}


async function generateOvervierw() {
  const processor = unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeStringify)
    .use(remarkFrontmatter)
    .use(function () {
      return function (_tree, file) {
        matter(file)
      }
    })
  for (const key in allRoutes) {
    console.log(key)
    // ignore the first 4 segments, which are [empty]/src/data/routes/
    const segments = key.split("/").slice(4)

    const lastSegment = segments[segments.length - 1]
    if (!lastSegment.endsWith(".md")) {
      // This is an empty directory, ignore it
      continue
    }

    // Process the path until the filename
    let current = routeRoot
    let path = "/routes"
    for (const segment of segments.slice(0, -1)) {
      path += `/${segment}`
      // First, assert that this is a
      if (Object.prototype.hasOwnProperty.call(current.children, segment)) {
        current = current.children[segment] as AreaNode
      } else {
        const newChild = {
          kind: "area",
          link: path,
          name: sanitizeFilename(segment),
          children: {},
        } satisfies AreaNode
        // sanitize the filename: replace _ with spaces
        current.children[segment] = newChild
        current = newChild
      }
    }

    // Process the filename
    const filename = lastSegment.slice(0, -3)

    const raw_import = (await allRoutes[key]()) as { default: string }
    const contents = raw_import.default

    const file = await processor.process(contents)

    const html = String(file)
    const errors = reporter(file)
    const isArea = filename === "+index"

    if (isArea) {
      const frontmatter = file.data.matter as AreaFrontmatter | null
      current = {
        ...current,
        ...frontmatter,
        errors,
        description: html,
        name: frontmatter && Object.prototype.hasOwnProperty.call(frontmatter, "name") ? frontmatter.name : sanitizeFilename(filename),
      }
      continue
    }

    const frontmatter = file.data.matter as RouteFrontmatter

    const child = {
      kind: "route",
      link: `${path}/${filename}`,
      errors,
      description: html,
      ...frontmatter,
      name: Object.prototype.hasOwnProperty.call(frontmatter, "name") ? frontmatter.name : sanitizeFilename(filename),
    } as RouteNode

    current.children[filename] = child
  }
}

generateOvervierw()


export function isAreaNode(node: TreeNode): node is AreaNode {
  return node.kind === "area"
}

export function getRouteFromPath(path: string) {
  const segments = path.split("/")
  let current: TreeNode = routeRoot
  for (const segment of segments) {
    if (!isAreaNode(current)) {
      return null
    }

    if (!Object.prototype.hasOwnProperty.call(current.children, segment)) {
      return null
    }

    current = current.children[segment] as TreeNode
  }
  return current
}
