import { defineConfig, createLogger } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { isAllowedShikiLang } from "./src/shared/lib/pierre-shiki-langs";

const shikiShim = fileURLToPath(new URL("./src/shims/shiki.ts", import.meta.url));
const shikiWasmShim = fileURLToPath(new URL("./src/shims/shiki-wasm.ts", import.meta.url));

const shikiLangImport = /[/\\]@shikijs[/\\]langs[/\\]([^/\\]+?)(?:\.mjs)?$/;

/** Only allowlisted @shikijs/langs/* may be bundled (see pierre-shiki-langs.ts). */
function allowlistShikiLanguageBundles() {
  return {
    name: "allowlist-shiki-language-bundles",
    enforce: "pre" as const,
    resolveId(id: string) {
      const match = id.match(shikiLangImport);
      if (!match) return null;
      if (isAllowedShikiLang(match[1]!)) return null;
      return "\0shiki-lang-excluded";
    },
    load(id: string) {
      if (id === "\0shiki-lang-excluded") {
        return "export default { name: \"text\", scopeName: \"source.text\", patterns: [] };";
      }
      return null;
    },
  };
}

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
  root: fileURLToPath(new URL(".", import.meta.url)),
  customLogger: logger,
  plugins: [excludeTestFilesFromBuild(), allowlistShikiLanguageBundles(), vue(), tailwindcss()],
  worker: {
    format: "es",
    plugins: () => [allowlistShikiLanguageBundles()],
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@pierre/diffs/worker") || id.includes("pierre/diffs/worker")) {
            return "pierre-worker";
          }
        },
      },
    },
  },
  resolve: {
    alias: [
      { find: "shiki/wasm", replacement: shikiWasmShim },
      { find: /^shiki$/, replacement: shikiShim },
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
      {
        find: "@server",
        replacement: fileURLToPath(new URL("../server", import.meta.url)),
      },
    ],
  },
  build: {
    // Monorepo: UI lands in repo-root dist/public (outside frontend/).
    outDir: "../dist/public",
    emptyOutDir: true,
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
        // @vueuse/core prebuilt dist — harmless misplaced #__PURE__ in dependency
        if (warning.code === "INVALID_ANNOTATION") return;
        if (warning.message?.includes("annotation that Rollup cannot interpret")) return;
        warn(warning);
      },
    },
  },
  optimizeDeps: {
    exclude: ["@wterm/dom", "@wterm/vue"],
  },
});
