import { readFile } from "fs/promises";
import { join } from "path";

import { error, json } from "@sveltejs/kit";

import type { DataJSON } from "$lib/types";

import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
  const path = join(process.cwd(), "src/climbing_data_gen/data/world", params.slug, "data.json");

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

// since there's no dynamic data here, we can prerender
// it so that it gets served as a static asset in production
export const prerender = true;
