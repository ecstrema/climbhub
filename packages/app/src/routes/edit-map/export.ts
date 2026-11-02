import { strToU8, zipSync, type Zippable } from "fflate";

import type { DataChanges, EditorStore } from "./editor.svelte";

const README = `Boundaries exported by the boundary editor of Climbhub (/edit-map).

Replace packages/reverse-geocoding-data/data with the data/ directory of this archive:

  cd packages/reverse-geocoding-data
  rm -rf data && unzip -o <this archive> -x README.txt && bun run build
`;

/** Builds the zip of the whole data/ directory of packages/reverse-geocoding-data. */
export function exportZip(store: EditorStore): Uint8Array {
  const files: Zippable = { "README.txt": strToU8(README) };
  for (const [path, text] of Object.entries(store.files())) files[`data/${path}`] = strToU8(text);
  return zipSync(files, { level: 6 });
}

/** Builds the zip of the files of data/ that were added or modified, to drop on GitHub's upload page. */
export function exportChangesZip(changes: DataChanges): Uint8Array {
  const files: Zippable = {};
  for (const [path, text] of changes.write) files[`data/${path}`] = strToU8(text);
  return zipSync(files, { level: 6 });
}

export function downloadBlob(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
