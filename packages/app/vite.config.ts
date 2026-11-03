import { execSync } from "child_process";
import adapter from "@sveltejs/adapter-static";
import tailwindcss from "@tailwindcss/vite";
import devtoolsJson from "vite-plugin-devtools-json";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      // Consult https://kit.svelte.dev/docs/integrations#preprocessors
      // for more information about preprocessors
      preprocess: [],
      adapter: adapter(),
      paths: { base: "/climbhub" },
      prerender: { concurrency: 8, handleUnseenRoutes: "warn" },
      version: {
        pollInterval: 15 * 60 * 1000 /* 15 minutes */,
        name: execSync("git rev-parse HEAD").toString().trim(),
      },
    }),
    devtoolsJson(),
  ],
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
