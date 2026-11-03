import { spawn } from "node:child_process";
import { readFile } from "fs/promises";
import { join, resolve } from "path";

import { OUT_DIR as OUT_GEN_DIR } from "@climbhub/climbing-data-gen";
import { error } from "@sveltejs/kit";

export function jsonRawBuffer(body: NonSharedBuffer) {
  return new Response(body, {
    headers: {
      "content-type": "application/json",
      "content-length": body.length.toString(),
    },
  });
}

export const rootPath = join(OUT_GEN_DIR, "world");
const repositoryRoot = resolve(OUT_GEN_DIR, "../../..");

let dataGenerationPromise: Promise<void> | undefined;

function runDataGeneration(): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("bun", ["run", "build:climbing-data-gen"], {
      cwd: repositoryRoot,
      stdio: "inherit",
    });

    child.once("error", rejectPromise);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`Climbing data generation failed (code ${code}, signal ${signal ?? "none"})`));
      }
    });
  });
}

export async function readGeneratedJson(path: string) {
  try {
    return await readFile(path);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== "ENOENT") throw cause;
  }

  if (!dataGenerationPromise) {
    dataGenerationPromise = runDataGeneration().finally(() => {
      dataGenerationPromise = undefined;
    });
  }

  await dataGenerationPromise;
  return readFile(path);
}

export async function withErrorHandler<T>(fn: () => T | Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.log("catching error");
    if (err instanceof Error) return error(404, err.message);
    if (typeof err === "string") return error(404, err);

    return error(404, JSON.stringify(err));
  }
}
