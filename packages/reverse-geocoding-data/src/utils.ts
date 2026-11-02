import { existsSync, mkdirSync } from "node:fs";

export { slugify } from "./shared.ts";

export function ensureDirExists(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
