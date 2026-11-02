import { execFile } from "node:child_process";
import { existsSync, statSync } from "fs";
import { mkdir, readdir, readFile, rm, rmdir, writeFile } from "fs/promises";
import { dirname, join, relative, resolve, sep } from "path";
import { promisify } from "node:util";

import { error, json } from "@sveltejs/kit";
import { BOUNDARY_EXTENSION, DATA_DIR } from "@climbhub/reverse-geocoding-data";
import { getWorldClimbingPoints, WORLD_CLIMBING_POINTS_FILE } from "@climbhub/climbing-data-gen";

import type { RequestHandler } from "./$types";
import {
  MAX_STAGE_AREAS,
  type BoundaryState,
  type BoundaryStates,
  type DataFiles,
} from "../../../edit-map/types";

const execFileAsync = promisify(execFile);
const REPO_ROOT = resolve(DATA_DIR, "../../..");

// Dev-only endpoints of the boundary editor (/edit-map). They are never linked from a page, so
// they are never prerendered: they only exist in `vite dev`.

async function readDataFiles(): Promise<DataFiles> {
  const files: DataFiles = {};
  if (!existsSync(DATA_DIR)) return files;
  for (const entry of await readdir(DATA_DIR, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith(BOUNDARY_EXTENSION)) continue;
    const path = join(entry.parentPath, entry.name);
    files[relative(DATA_DIR, path).split(sep).join("/")] = await readFile(path, "utf8");
  }
  return files;
}

/** Git states for boundary files: untracked, unstaged, staged, or unchanged from HEAD. */
async function readGitAreaStates(): Promise<BoundaryStates> {
  const dataPrefix = relative(REPO_ROOT, DATA_DIR).split(sep).join("/");
  const { stdout } = await execFileAsync(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", dataPrefix],
    { cwd: REPO_ROOT },
  );
  const states: BoundaryStates = {};
  for (const entry of stdout.split("\0")) {
    if (entry.length < 4 || entry[2] !== " ") continue;
    const indexStatus = entry[0]!;
    const worktreeStatus = entry[1]!;
    const path = entry.slice(3).replaceAll("\\", "/");
    const prefix = `${dataPrefix}/`;
    if (!path.startsWith(prefix) || !path.endsWith(BOUNDARY_EXTENSION)) continue;

    let state: BoundaryState;
    if (indexStatus === "?" && worktreeStatus === "?") state = "new";
    else if (worktreeStatus !== " ") state = "modified";
    else if (indexStatus !== " ") state = "staged";
    else continue;
    states[path.slice(prefix.length)] = state;
  }
  return states;
}

/** Absolute path of a boundary file of data/, refusing anything outside of it */
function dataPath(path: string) {
  const absolute = resolve(DATA_DIR, path);
  if (!absolute.startsWith(DATA_DIR + sep) || !absolute.endsWith(BOUNDARY_EXTENSION)) {
    error(400, `Invalid path ${path}`);
  }
  return absolute;
}

/** Removes the directories left empty by a deletion */
async function removeEmptyParents(file: string) {
  for (let dir = dirname(file); dir.startsWith(DATA_DIR + sep); dir = dirname(dir)) {
    if ((await readdir(dir)).length) return;
    await rmdir(dir);
  }
}

async function countBoundaryFiles(path: string): Promise<number> {
  const stat = statSync(path, { throwIfNoEntry: false });
  if (!stat) return 0;
  if (!stat.isDirectory()) return stat.isFile() && path.endsWith(BOUNDARY_EXTENSION) ? 1 : 0;

  let count = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.isDirectory()) count += await countBoundaryFiles(join(path, entry.name));
    else if (entry.isFile() && entry.name.endsWith(BOUNDARY_EXTENSION)) count++;
  }
  return count;
}

export const GET: RequestHandler = async ({ params }) => {
  switch (params.resource) {
    case "files.json":
      return json(await readDataFiles());
    case "git-status.json":
      if (!import.meta.env.DEV) error(404, `Unknown resource ${params.resource}`);
      return json(await readGitAreaStates());
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

/** Writes the changes of the editor to data/: `{ write: { [path]: content }, delete: path[] }` */
const put: RequestHandler = async ({ params, request }) => {
  if (params.resource !== "files.json") error(404, `Unknown resource ${params.resource}`);
  const changes: { write: DataFiles; delete: string[] } = await request.json();
  const writes = Object.entries(changes.write).map(([path, text]) => [dataPath(path), text]);
  const deletes = changes.delete.map(dataPath);

  for (const file of deletes) {
    await rm(file, { force: true });
    await removeEmptyParents(file);
  }
  for (const [file, text] of writes) {
    await mkdir(dirname(file!), { recursive: true });
    await writeFile(file!, text!);
  }
  return json({ written: writes.length, deleted: deletes.length });
};

/** Stages one area (and all its descendants) in the local repository's Git index. */
const post: RequestHandler = async ({ params, request }) => {
  if (params.resource !== "stage.json") error(404, `Unknown resource ${params.resource}`);
  const body: unknown = await request.json();
  const path = body && typeof body === "object" ? (body as { path?: unknown }).path : undefined;
  const confirmedLarge =
    body &&
    typeof body === "object" &&
    (body as { confirmedLarge?: unknown }).confirmedLarge === true;
  if (typeof path !== "string" || !/^world(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(path)) {
    error(400, "Invalid area path");
  }

  const world = resolve(DATA_DIR, "world");
  const area = resolve(DATA_DIR, path);
  if (area !== world && !area.startsWith(world + sep)) error(400, "Invalid area path");
  const target =
    existsSync(area) && statSync(area).isDirectory() ? area : `${area}${BOUNDARY_EXTENSION}`;
  const areas = await countBoundaryFiles(target);
  if (areas === 0) error(400, "This selection has no boundary areas to stage");
  if (areas > MAX_STAGE_AREAS && !confirmedLarge)
    error(409, `Confirm staging ${areas} areas before continuing`);
  const gitPath = relative(REPO_ROOT, target).split(sep).join("/");
  try {
    await execFileAsync("git", ["add", "-A", "--", gitPath], { cwd: REPO_ROOT });
  } catch (e) {
    error(500, `git add failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  return json({ staged: path, areas, states: await readGitAreaStates() });
};

// Endpoints with mutative methods cannot be prerendered, and the static build only accepts
// prerendered routes: PUT and POST only exist in development.
export const PUT = import.meta.env.DEV ? put : undefined;
export const POST = import.meta.env.DEV ? post : undefined;
export const prerender = !import.meta.env.DEV;
