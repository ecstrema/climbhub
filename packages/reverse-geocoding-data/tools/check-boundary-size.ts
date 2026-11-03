// Fails if one of the given boundary files is larger than LARGE_BOUNDARY_BYTES.
// Used by .github/workflows/check-boundaries.yml on files added or modified by a pull request.
import { statSync } from "fs";

import { LARGE_BOUNDARY_BYTES } from "../src/shared.ts";

let failed = 0;
for (const file of process.argv.slice(2)) {
  const size = statSync(file).size;
  if (size > LARGE_BOUNDARY_BYTES) {
    console.error(
      `❌ ${file} is ${Math.round(size / 1024)} KB (> ${LARGE_BOUNDARY_BYTES / 1024} KB): simplify it in /edit-map.`,
    );
    failed++;
  }
}
if (failed) process.exit(1);
console.log(`✅ ${process.argv.length - 2} boundary file(s) checked`);
