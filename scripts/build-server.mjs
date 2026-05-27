import * as esbuild from "esbuild";
import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";

const outdir = "dist/cli";
const outfile = `${outdir}/index.cjs`;

/** Native addons and ws (CJS interop) stay in node_modules at runtime. */
const external = ["better-sqlite3", "node-pty", "ws"];

const TEST_FILE =
  /(?:^|[/\\])([^/\\]+)\.(test|spec)\.(?:[cm]?[jt]s|[cm]?[jt]sx?)(?:\?.*)?$/;

/** Fail the build if any test module is pulled into the server graph. */
const excludeTestFilesPlugin = {
  name: "exclude-test-files",
  setup(build) {
    build.onResolve({ filter: TEST_FILE }, (args) => {
      throw new Error(
        `Test files must not be bundled (imported from ${args.importer}): ${args.path}`,
      );
    });
    build.onLoad({ filter: TEST_FILE }, (args) => {
      throw new Error(`Test files must not be bundled: ${args.path}`);
    });
  },
};

function assertBundleExcludesTests() {
  const bundle = readFileSync(outfile, "utf8");
  const forbidden = [
    { label: "vitest", pattern: /\bvitest\b/ },
    { label: "app.test", pattern: /app\.test/ },
    { label: "transport.test", pattern: /transport\.test/ },
    { label: "args.test", pattern: /args\.test/ },
  ];
  for (const { label, pattern } of forbidden) {
    if (pattern.test(bundle)) {
      throw new Error(`Server bundle must not include test code (matched ${label})`);
    }
  }
}

// Remove legacy tsc output (including compiled *.test.js) and prior CLI bundles.
rmSync("dist/server", { recursive: true, force: true });
rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

await esbuild.build({
  entryPoints: ["cli/index.ts"],
  outfile,
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  minify: true,
  minifyWhitespace: true,
  minifyIdentifiers: true,
  minifySyntax: true,
  treeShaking: true,
  legalComments: "none",
  sourcemap: false,
  external,
  plugins: [excludeTestFilesPlugin],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  banner: {
    js: "#!/usr/bin/env node",
  },
  packages: "bundle",
  logLevel: "info",
});

assertBundleExcludesTests();

const kb = (statSync(outfile).size / 1024).toFixed(1);
console.log(`  Server bundle: ${outfile} (${kb} KB, minified, tests excluded)`);
