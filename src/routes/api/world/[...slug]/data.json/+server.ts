import { readFile } from "fs/promises";
import { join } from "path";

import { error, json } from "@sveltejs/kit";

import type { DataJSON } from "$lib/types";

import type { RequestHandler } from "./$types";
import { rootPath } from "../utils";

export const GET: RequestHandler = async ({ params }) => {
  const path = join(rootPath, params.slug, "data.json");

  try {
    const data: DataJSON = JSON.parse(await readFile(path, { encoding: "utf-8" }));
    return json(data);
  } catch (err) {
    if (err instanceof Error) {
      error(404, err.message);
    }
    throw err;
  }
};
