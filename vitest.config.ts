import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      {
        find: "@",
        replacement: fileURLToPath(new URL("./frontend/src", import.meta.url)),
      },
    ],
  },
  test: {
    include: ["cli/**/*.test.ts", "frontend/src/**/*.test.ts"],
  },
});
