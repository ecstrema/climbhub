import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OUT_DIR } from "@climbhub/climbing-data-gen";
import type { ApiFile } from "./api-url";

/** Reads a generated file directly, for server side rendering and prerendering. */
export async function readApiJson<T>(slug: string, file: ApiFile): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(join(OUT_DIR, "world", slug, file), "utf8"));
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw cause;
  }
}
