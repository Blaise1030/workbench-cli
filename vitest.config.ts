import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      {
        find: "@",
        replacement: fileURLToPath(new URL("./apps/frontend/src", import.meta.url)),
      },
    ],
  },
  test: {
    include: ["apps/cli/**/*.test.ts", "apps/frontend/src/**/*.test.ts"],
    setupFiles: [fileURLToPath(new URL("./vitest.setup.ts", import.meta.url))],
  },
});
