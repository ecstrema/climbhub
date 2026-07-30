import { existsSync, mkdirSync } from "node:fs";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function ensureDirExists(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
