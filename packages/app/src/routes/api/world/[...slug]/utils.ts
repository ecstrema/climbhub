import { readFile, writeFile } from "fs/promises";
import { join } from "path";

import { OUT_DIR as OUT_GEN_DIR } from "@climbhub/climbing-data-gen";

export function jsonRawBuffer(body: NonSharedBuffer) {
  return new Response(body, {
    headers: {
      "content-type": "application/json",
      "content-length": body.length.toString(),
    },
  });
}

const textEncoder = new TextEncoder();

export function jsonRawString(body: string) {
  return new Response(body, {
    headers: {
      "content-type": "application/json",
      "content-length": textEncoder.encode(body).byteLength.toString(),
    },
  });
}

export function jsonAndSave(body: unknown, path: string) {
  const stringData = JSON.stringify(body);
  try {
    writeFile(path, stringData);
  } catch {}
  return jsonRawString(stringData);
}

export const rootPath = join(OUT_GEN_DIR, "world");

export async function withCache(cachePath: string, compute: () => Promise<unknown> | unknown) {
  try {
    return jsonRawBuffer(await readFile(cachePath));
  } catch {} // The file does not exist, or another error, fallback to regenerating it.

  return jsonAndSave(await compute(), cachePath);
}
