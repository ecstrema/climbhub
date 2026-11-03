import { join } from "path";
import type { RequestHandler } from "./$types";
import { jsonRawBuffer, readGeneratedJson, rootPath, withErrorHandler } from "../utils";

export const GET: RequestHandler = async ({ params }) => {
  const path = join(rootPath, params.slug);
  const childrenPath = join(path, "children.json");

  return withErrorHandler(async () => jsonRawBuffer(await readGeneratedJson(childrenPath)));
};

export const prerender = true;
