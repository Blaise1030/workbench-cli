import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vue from '@astrojs/vue';

// GitHub Pages: https://blaise1030.github.io/
export default defineConfig({
  site: 'https://blaise1030.github.io',
  output: 'static',
  integrations: [vue()],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    syntaxHighlight: false,
  },
});
