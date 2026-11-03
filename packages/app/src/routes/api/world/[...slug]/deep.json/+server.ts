import { join } from "path";

import type { RequestHandler } from "./$types";
import { jsonRawBuffer, readGeneratedJson, rootPath, withErrorHandler } from "../utils";

/**
 * The deep endpoint returns all grandchildren, grandgrandchildren, etc. Every subchild that is not a direct child.
 * It is used to download all the missing data if the user wants to download an area, but has almost only the direct children.
 */
export const GET: RequestHandler = async ({ params }) => {
  const path = join(rootPath, params.slug);
  const deepPath = join(path, "deep.json");

  return withErrorHandler(async () => jsonRawBuffer(await readGeneratedJson(deepPath)));
};

export const prerender = true;
