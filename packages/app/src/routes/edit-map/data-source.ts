import { base } from "$app/paths";
import type { DataChanges } from "./editor.svelte";
import type { BoundaryStates, DataFiles } from "./types";

// With `vite dev`, data/ is read and written directly on the disk through /api/edit-map/files.json.
// That endpoint does not exist on the deployed site, which reads data/ from GitHub instead.

export async function loadFromDisk(): Promise<DataFiles> {
  const res = await fetch(`${base}/api/edit-map/files.json`);
  if (!res.ok) throw new Error(`files.json: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function loadGitStatesFromDisk(): Promise<BoundaryStates> {
  const res = await fetch(`${base}/api/edit-map/git-status.json`);
  if (!res.ok) throw new Error(`git-status.json: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function saveToDisk(changes: DataChanges) {
  const res = await fetch(`${base}/api/edit-map/files.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ write: Object.fromEntries(changes.write), delete: changes.delete }),
  });
  if (!res.ok) throw new Error(`Saving failed: ${res.status} ${await res.text()}`);
}

export async function stageOnDisk(path: string, confirmedLarge = false): Promise<BoundaryStates> {
  const res = await fetch(`${base}/api/edit-map/stage.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, confirmedLarge }),
  });
  if (!res.ok) throw new Error(`Staging failed: ${res.status} ${await res.text()}`);
  const { states }: { states: BoundaryStates } = await res.json();
  return states;
}
