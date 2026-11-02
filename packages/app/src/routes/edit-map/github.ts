import { DATA_DIR_IN_REPO } from "@climbhub/reverse-geocoding-data/shared";
import type { DataFiles } from "./types";

// The deployed site is static: it reads data/ from GitHub, and the changes are proposed through
// the upload page of GitHub, which forks the repository for the user. No token, no server of ours.

export const REPOSITORY = { owner: "ecstrema", repo: "climbhub", branch: "main" };
const UPSTREAM = `${REPOSITORY.owner}/${REPOSITORY.repo}`;

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (!res.ok) {
    const body = await res.text();
    let message = body;
    try {
      message = JSON.parse(body).message ?? body;
    } catch {}
    throw new Error(`GitHub ${path}: ${res.status} ${message}`);
  }
  return res.json();
}

interface TreeEntry {
  path: string;
  type: "blob" | "tree" | "commit";
  sha: string;
}

/** The commit at the head of the branch, and the files of data/ in it */
async function dataTree() {
  const commit = await api<{ sha: string; commit: { tree: { sha: string } } }>(
    `/repos/${UPSTREAM}/commits/${REPOSITORY.branch}`,
  );
  const tree = await api<{ tree: TreeEntry[]; truncated: boolean }>(
    `/repos/${UPSTREAM}/git/trees/${commit.commit.tree.sha}?recursive=1`,
  );
  if (tree.truncated) throw new Error("The tree of the repository is too large to be listed");
  const prefix = `${DATA_DIR_IN_REPO}/`;
  const entries = tree.tree.filter((e) => e.type === "blob" && e.path.startsWith(prefix));
  return { commit: commit.sha, prefix, entries };
}

/** Reads data/ from the head of the branch */
export async function loadFromGitHub(onProgress?: (done: number, total: number) => void) {
  const { commit, prefix, entries } = await dataTree();
  const files: DataFiles = {};
  let done = 0;
  // raw.githubusercontent.com is not rate limited like the API. A few requests at a time.
  const queue = [...entries];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let entry = queue.shift(); entry; entry = queue.shift()) {
        const res = await fetch(
          `https://raw.githubusercontent.com/${UPSTREAM}/${commit}/${entry.path}`,
        );
        if (!res.ok) throw new Error(`${entry.path}: ${res.status} ${res.statusText}`);
        files[entry.path.slice(prefix.length)] = await res.text();
        onProgress?.(++done, entries.length);
      }
    }),
  );
  return { files, commit };
}

/** The upload page of GitHub, in the parent directory of data/: a dropped data/ folder replaces its files */
export const UPLOAD_URL = `https://github.com/${UPSTREAM}/upload/${REPOSITORY.branch}/${DATA_DIR_IN_REPO.split("/").slice(0, -1).join("/")}`;

/** GitHub refuses more files than this in one upload */
export const UPLOAD_MAX_FILES = 100;
