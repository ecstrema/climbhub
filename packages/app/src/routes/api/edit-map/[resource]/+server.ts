import { existsSync } from "fs";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import * as yaml from "js-yaml";

import { error, json } from "@sveltejs/kit";
import { CONFIG_DIR, OUTPUT_DIR, type YamlConfig } from "@climbhub/reverse-geocoding-data";
import {
  getWorldClimbingPoints,
  WORLD_CLIMBING_POINTS_FILE,
} from "@climbhub/climbing-data-gen";

import type { RequestHandler } from "./$types";
import type { ConfigFile, ServerTreeNode } from "../../../edit-map/types";

// Dev-only endpoints of the boundary editor (/edit-map). They are never linked from a page, so
// they are never prerendered: they only exist in `vite dev`.

async function listDir(dir: string) {
  if (!existsSync(dir)) return [];
  return readdir(dir, { withFileTypes: true });
}

async function readTree(relativePath: string, slug: string): Promise<ServerTreeNode> {
  const configDir = join(CONFIG_DIR, relativePath);
  const outputDir = join(OUTPUT_DIR, relativePath);
  const [configEntries, outputEntries] = await Promise.all([listDir(configDir), listDir(outputDir)]);

  const configs: ConfigFile[] = [];
  for (const entry of configEntries) {
    if (!entry.isFile()) continue;
    if (entry.name !== "config.yaml" && !entry.name.endsWith(".config.yaml")) continue;
    const raw = await readFile(join(configDir, entry.name), "utf8");
    configs.push({ file: entry.name, raw, config: (yaml.load(raw) ?? {}) as YamlConfig });
  }
  // config.yaml first, then the others in walking order
  configs.sort((a, b) =>
    a.file === "config.yaml" ? -1 : b.file === "config.yaml" ? 1 : a.file.localeCompare(b.file),
  );

  const node: ServerTreeNode = { slug, configs, children: [] };

  const manualBoundary = join(configDir, "boundary.geojson");
  const generatedBoundary = join(outputDir, "boundary.geojson");
  if (existsSync(manualBoundary)) {
    node.boundary = JSON.parse(await readFile(manualBoundary, "utf8"));
    node.boundarySource = "manual";
  } else if (existsSync(generatedBoundary)) {
    node.boundary = JSON.parse(await readFile(generatedBoundary, "utf8"));
    node.boundarySource = "generated";
  }

  // Children are the union of the directories in data/ and output/. Same order as the pipeline.
  const childSlugs = new Set<string>();
  for (const entry of [...configEntries, ...outputEntries]) {
    if (entry.isDirectory() && !entry.name.startsWith(".")) childSlugs.add(entry.name);
  }
  node.children = await Promise.all(
    [...childSlugs].sort().map((child) => readTree(join(relativePath, child), child)),
  );

  return node;
}

export const GET: RequestHandler = async ({ params }) => {
  switch (params.resource) {
    case "tree.json":
      return json(await readTree("world", "world"));
    // The download takes minutes: instead of keeping the request open, it runs in the background
    // and these answer 202 with its progress until it is done. The page polls climbing.json.
    case "climbing.json":
    case "climbing-refresh.json": {
      const force = params.resource === "climbing-refresh.json";
      const result = await getWorldClimbingPoints(WORLD_CLIMBING_POINTS_FILE, { force });
      return "data" in result ? json(result.data) : json(result.status, { status: 202 });
    }
  }
  error(404, `Unknown resource ${params.resource}`);
};

export const prerender = true;
