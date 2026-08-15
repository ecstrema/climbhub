import { execSync } from "child_process";
import adapter from "@sveltejs/adapter-static";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://kit.svelte.dev/docs/integrations#preprocessors
  // for more information about preprocessors
  preprocess: [],

  kit: {
    adapter: adapter(),
    paths: {
      base: "/climbhub",
    },
    alias: {
      "@/*": "./src/lib/components/*",
    },
    prerender: {
      handleUnseenRoutes: "warn",
    },
    version: {
      pollInterval: 15 * 60 * 1000, // 15 minutes
      name: execSync("git rev-parse HEAD").toString().trim(),
    },
  },
};

export default config;
