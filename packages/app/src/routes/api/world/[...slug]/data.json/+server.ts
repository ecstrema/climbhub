import { join } from "path";

import type { RequestHandler } from "./$types";
import { jsonRawBuffer, readGeneratedJson, rootPath, withErrorHandler } from "../utils";

export const GET: RequestHandler = async ({ params }) => {
  const path = join(rootPath, params.slug, "data.json");

  return withErrorHandler(async () => {
    return jsonRawBuffer(await readGeneratedJson(path));
  });
};

export const prerender = true;
