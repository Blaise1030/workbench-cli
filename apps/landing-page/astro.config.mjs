import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import vue from "@astrojs/vue";

// GitHub Pages project site: https://blaise1030.github.io/workbench-cli/
export default defineConfig({
  site: "https://blaise1030.github.io",
  base: "/workbench-cli",
  output: "static",
  integrations: [vue()],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    syntaxHighlight: false,
  },
});
