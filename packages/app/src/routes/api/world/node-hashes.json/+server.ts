import { join } from "path";

import { OUT_DIR } from "@climbhub/climbing-data-gen";
import { readGeneratedJson } from "../[...slug]/utils";

import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
  const hashes = await readGeneratedJson(join(OUT_DIR, "node-hashes.json"));
  return new Response(hashes, {
    headers: {
      "cache-control": "no-store",
      "content-length": hashes.length.toString(),
      "content-type": "application/json",
    },
  });
};

export const prerender = true;
