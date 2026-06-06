import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import vue from "@astrojs/vue";

export default defineConfig({
  site: "https://apps-landing-page.pages.dev",
  output: "static",
  integrations: [vue()],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    syntaxHighlight: false,
  },
});
