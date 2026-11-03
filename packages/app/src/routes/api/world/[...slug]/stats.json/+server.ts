import { join } from "path";

import type { RequestHandler } from "./$types";
import { jsonRawBuffer, readGeneratedJson, rootPath, withErrorHandler } from "../utils";

export const GET: RequestHandler = async ({ params }) => {
  const path = join(rootPath, params.slug);

  return withErrorHandler(async () => jsonRawBuffer(await readGeneratedJson(join(path, "stats.json"))));
};

export const prerender = true;
