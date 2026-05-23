import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "https://localhost:3001",
        secure: false,
        changeOrigin: true,
      },
      "/auth": {
        target: "https://localhost:3001",
        secure: false,
        changeOrigin: true,
      },
      "/ws": {
        target: "wss://localhost:3001",
        ws: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: "dist/public",
  },
  optimizeDeps: {
    exclude: ["@wterm/dom", "@wterm/vue"],
  },
});
