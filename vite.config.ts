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

const testFilePattern =
  /(?:^|[/\\])([^/\\]+)\.(test|spec)\.(?:[cm]?[jt]s|[cm]?[jt]sx?)$/;

function excludeTestFilesFromBuild() {
  return {
    name: "exclude-test-files-from-build",
    enforce: "pre",
    apply: "build",
    resolveId(id: string) {
      if (testFilePattern.test(id)) {
        throw new Error(`Test files must not be included in production build: ${id}`);
      }
      return null;
    },
  };
}

export default defineConfig({
  customLogger: logger,
  plugins: [excludeTestFilesFromBuild(), vue(), tailwindcss()],
  worker: {
    format: "es",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@server": fileURLToPath(new URL("./server", import.meta.url)),
    },
  },
  build: {
    outDir: "dist/public",
    target: "es2020",
    minify: "terser",
    cssMinify: true,
    sourcemap: false,
    reportCompressedSize: true,
    terserOptions: {
      compress: {
        drop_console: true,
        passes: 2,
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@codemirror") || id.includes("/codemirror")) {
            return "vendor-codemirror";
          }
          if (id.includes("@xterm") || id.includes("/xterm")) {
            return "vendor-xterm";
          }
          if (id.includes("@pierre")) {
            return "vendor-pierre";
          }
          if (
            id.includes("/vue/") ||
            id.includes("@vue") ||
            id.includes("vue-router") ||
            id.includes("@tanstack")
          ) {
            return "vendor-vue";
          }
        },
      },
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
