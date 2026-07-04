import { defineConfig, createLogger } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { isAllowedShikiLang } from "./src/shared/lib/pierre-shiki-langs";
import { visualizer } from "rollup-plugin-visualizer";

const shikiShim = fileURLToPath(new URL("./src/shims/shiki.ts", import.meta.url));
const shikiWasmShim = fileURLToPath(new URL("./src/shims/shiki-wasm.ts", import.meta.url));

const relativeImport = /^\.\.?[/\\]/;

/** Excludes non-allowlisted deep imports from a @shikijs/<pkg> package, including
 * relative imports from within that package's own barrel file (e.g. shiki's full
 * bundle doing `import("./javascript.mjs")` from inside @shikijs/langs/dist/index.mjs). */
function excludeShikiSubmodules(pkg: string, isAllowed: (id: string) => boolean) {
  const deepImport = new RegExp(`(?:^|[/\\\\])@shikijs[/\\\\]${pkg}[/\\\\]([^/\\\\]+?)(?:\\.mjs)?$`);
  const pkgDir = new RegExp(`(?:^|[/\\\\])@shikijs[/\\\\]${pkg}[/\\\\]`);
  const excludedId = `\0shiki-${pkg}-excluded`;
  return {
    name: `allowlist-shiki-${pkg}-bundles`,
    enforce: "pre" as const,
    resolveId(id: string, importer?: string) {
      let match = id.match(deepImport);
      if (!match && importer && pkgDir.test(importer) && relativeImport.test(id)) {
        match = id.match(/([^/\\]+?)(?:\.mjs)?$/);
      }
      if (!match) return null;
      if (isAllowed(match[1]!)) return null;
      return excludedId;
    },
    load(id: string) {
      if (id === excludedId) {
        return "export default { name: \"text\", scopeName: \"source.text\", patterns: [] };";
      }
      return null;
    },
  };
}

/** Only allowlisted @shikijs/langs/* may be bundled (see pierre-shiki-langs.ts). */
function allowlistShikiLanguageBundles() {
  return excludeShikiSubmodules("langs", isAllowedShikiLang);
}

/** No built-in @shikijs/themes/* are used — the app only registers custom
 * CSS-variable themes ("pierre-shadcn-dark/light") via @pierre/theme. */
function allowlistShikiThemeBundles() {
  return excludeShikiSubmodules("themes", () => false);
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

const goDevBackend = process.env.WORKBENCH_DEV_BACKEND === "go";
const goPort = Number(process.env.WORKBENCH_GO_PORT ?? 4740);
const viteDevPort = Number(process.env.VITE_DEV_PORT ?? 5173);

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  customLogger: logger,
  plugins: [
    excludeTestFilesFromBuild(),
    allowlistShikiLanguageBundles(),
    allowlistShikiThemeBundles(),
    vue(),
    tailwindcss(),
    ...(process.env.ANALYZE ? [visualizer({ open: true, filename: "dist/stats.html", gzipSize: true, brotliSize: true })] : []),
  ],
  // npm run dev:go — Vite HMR UI, Go handles /api and /ws
  ...(goDevBackend
    ? {
        server: {
          port: viteDevPort,
          strictPort: true,
          proxy: {
            "/api": {
              target: `http://127.0.0.1:${goPort}`,
              changeOrigin: true,
            },
            "/ws": {
              target: `ws://127.0.0.1:${goPort}`,
              ws: true,
            },
          },
        },
      }
    : {}),
  worker: {
    format: "es",
    plugins: () => [allowlistShikiLanguageBundles(), allowlistShikiThemeBundles()],
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
    ],
  },
  build: {
    // Monorepo: UI lands in repo-root dist/public (outside frontend/).
    outDir: "../../dist/public",
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
        chunkFileNames(chunkInfo) {
          if (
            chunkInfo.name.startsWith("vendor-") ||
            chunkInfo.name.startsWith("worker-")
          ) {
            return "assets/[name]-[hash].js";
          }
          const isFromAppSrc = chunkInfo.moduleIds.some(
            (id) =>
              id.includes("/apps/frontend/src/") && !id.startsWith("\0"),
          );
          return isFromAppSrc
            ? "assets/app-[name]-[hash].js"
            : "assets/[name]-[hash].js";
        },
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
