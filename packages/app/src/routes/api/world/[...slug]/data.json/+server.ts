import { readFile } from "fs/promises";
import { join } from "path";

import { error, json } from "@sveltejs/kit";

import type { RequestHandler } from "./$types";
import { rootPath, withErrorHandler } from "../utils";
import type { DataJSON } from "@climbhub/climbing-data-gen";

export const GET: RequestHandler = async ({ params }) => {
  const path = join(rootPath, params.slug, "data.json");

  return withErrorHandler(async () => {
    const data: DataJSON = JSON.parse(await readFile(path, { encoding: "utf-8" }));
    return json(data);
  })
};

export const prerender = true;
