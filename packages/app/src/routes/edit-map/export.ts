import { strToU8, zipSync, type Zippable } from "fflate";
import * as yaml from "js-yaml";

import { nodePath, walk, type EditorStore } from "./editor.svelte";

const README = `Configuration exported by the boundary editor of Climbhub (/edit-map).

Replace packages/reverse-geocoding-data/data with the data/ directory of this archive:

  cd packages/reverse-geocoding-data
  rm -rf data && unzip -o <this archive> && bun run build

stale-outputs.txt lists the directories of output/ whose boundary must be regenerated (their
query changed, or they were removed). Delete them before running the build:

  xargs -I{} rm -rf output/{} < stale-outputs.txt
`;

/** Builds the zip of the whole data/ directory of packages/reverse-geocoding-data. */
export function exportZip(store: EditorStore): Uint8Array {
  const files: Zippable = {};

  for (const node of walk(store.root)) {
    const dir = `data/${nodePath(node)}`;
    for (const { file, config, raw } of node.configs) {
      const text =
        raw !== undefined && !node.changedConfigs.has(file)
          ? raw
          : yaml.dump(config, { lineWidth: -1 });
      files[`${dir}/${file}`] = strToU8(text);
    }
    if (node.boundary && (node.origin === "manual" || node.origin === "edited")) {
      files[`${dir}/boundary.geojson`] = strToU8(JSON.stringify(node.boundary));
    }
  }

  const stale = new Set(store.stalePaths);
  for (const path of store.removedPaths) stale.add(path);
  files["stale-outputs.txt"] = strToU8([...stale].sort().join("\n") + (stale.size ? "\n" : ""));
  files["README.txt"] = strToU8(README);

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
