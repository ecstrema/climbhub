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
  },
};

export default config;
