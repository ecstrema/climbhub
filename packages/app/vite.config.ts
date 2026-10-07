import tailwindcss from "@tailwindcss/vite";
import devtoolsJson from "vite-plugin-devtools-json";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
  test: { include: ["src/**/*.{test,spec}.{js,ts}"] },
  server: {
    host: "127.0.0.1",
  },
  optimizeDeps: {
    // MapLibre loads its worker from next to its own module: pre-bundling would move the module
    // to .vite/deps without the worker
    exclude: ["maplibre-gl"],
  },
});
