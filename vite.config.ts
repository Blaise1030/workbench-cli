import { defineConfig, createLogger } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

const logger = createLogger();
const originalWarn = logger.warn.bind(logger);
logger.warn = (msg, options) => {
  if (msg.includes("points to missing source files")) return;
  originalWarn(msg, options);
};

export default defineConfig({
  customLogger: logger,
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@server": fileURLToPath(new URL("./server", import.meta.url)),
    },
  },
  build: {
    outDir: "dist/public",
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === "SOURCEMAP_ERROR") return;
        warn(warning);
      },
    },
  },
  optimizeDeps: {
    exclude: ["@wterm/dom", "@wterm/vue"],
  },
});
