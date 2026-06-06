import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import vue from "@astrojs/vue";

export default defineConfig({
  site: "https://workbench.nocodemonkeys1.workers.dev",
  output: "static",
  integrations: [vue()],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    syntaxHighlight: false,
  },
});
