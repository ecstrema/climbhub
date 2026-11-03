// Browser-safe part of the package: no node imports. Used by the boundary editor of the app.

/** Every leaf region is a `<slug>.geojson` file. Directories group regions, and have no boundary. */
export const BOUNDARY_EXTENSION = ".geojson";

/** Path of data/ in the repository */
export const DATA_DIR_IN_REPO = "packages/reverse-geocoding-data/data";

/** Boundaries larger than this must be simplified: pull requests cannot add or modify them (see src/check-size.ts) */
export const LARGE_BOUNDARY_BYTES = 50 * 1024;

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      // Letters that are not an accented letter, so that NFD does not keep their base letter
      .replace(/ß/g, "ss")
      .replace(/æ/g, "ae")
      .replace(/œ/g, "oe")
      .replace(/ø/g, "o")
      .replace(/ł/g, "l")
      .replace(/đ/g, "d")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[–—\s]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
  );
}
