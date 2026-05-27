# pnpm Monorepo Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the single-package repo into a pnpm monorepo with `frontend/`, `server/`, `cli/`, and `server-rs/` as distinct workspace packages.

**Architecture:** A pnpm workspace root coordinates four packages. `cli` depends on `server` via `workspace:*`. `frontend` is the Vite/Vue app. Shared dev tools (vite, typescript, vitest) live at the workspace root so pnpm hoists them — this keeps the dev server working without duplicating tooling deps. The existing esbuild bundle entry (`cli/index.ts`) and all `dist/` output paths are unchanged.

**Tech Stack:** pnpm workspaces, esbuild, Vite 6, Vue 3, Hono, TypeScript

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `pnpm-workspace.yaml` | Declares workspace packages |
| Rewrite | `package.json` | Workspace root: scripts + shared devDeps only |
| Create | `server/package.json` | Server runtime deps + name `@workbench/server` |
| Create | `server/tsconfig.json` | NodeNext tsconfig for server |
| Create | `cli/package.json` | CLI with `@workbench/server: workspace:*` |
| Create | `cli/tsconfig.json` | NodeNext tsconfig for cli |
| Modify | `cli/index.ts` | Change `../server/index.js` → `@workbench/server` |
| Move | `src/` → `frontend/src/` | Vue app source |
| Move | `index.html` → `frontend/index.html` | Vite entry HTML |
| Move | `public/` → `frontend/public/` | Static assets |
| Move | `vite.config.ts` → `frontend/vite.config.ts` | Vite config (paths updated) |
| Move | `components.json` → `frontend/components.json` | shadcn-vue config |
| Create | `frontend/package.json` | Frontend-specific deps |
| Create | `frontend/tsconfig.json` | Bundler tsconfig for frontend |
| Rewrite | `tsconfig.json` | Root: update paths + includes for new layout |
| Rewrite | `tsconfig.build.json` | Root: include server + cli (unchanged paths) |
| Modify | `scripts/build-server.mjs` | Update root path lookup |
| Modify | `scripts/package-release.mjs` | Read deps from `server/package.json` |

---

### Task 1: Create pnpm workspace root

**Files:**
- Create: `pnpm-workspace.yaml`
- Rewrite: `package.json`

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - frontend
  - server
  - cli
```

- [ ] **Step 2: Rewrite root `package.json`**

Replace the current `package.json` with a workspace root that keeps scripts and shared devDeps. The runtime dependencies move to `server/package.json` in Task 2. Shared build tooling (vite, typescript, vitest, esbuild, tsx, drizzle-kit) stays at root so pnpm hoists it for all packages.

```json
{
  "name": "workbench",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev": "NODE_ENV=development tsx watch server/index.ts",
    "build": "node scripts/build-server.mjs && vite build --config frontend/vite.config.ts && node scripts/assert-shiki-bundle.mjs",
    "typecheck": "tsc -p tsconfig.build.json --noEmit",
    "start": "NODE_ENV=production node dist/cli/index.cjs",
    "test": "vitest run",
    "package:release": "node scripts/package-release.mjs",
    "package:release:all": "node scripts/package-release.mjs --bundle-node",
    "build:rust": "node scripts/build-rust.mjs",
    "start:rust": "server-rs/target/release/workbench-cli --host 127.0.0.1 --http",
    "test:rust:smoke": "node scripts/smoke-test-rust.mjs",
    "prepublishOnly": "pnpm run build"
  },
  "devDependencies": {
    "@codemirror/commands": "^6.10.3",
    "@codemirror/lang-css": "^6.3.1",
    "@codemirror/lang-html": "^6.4.11",
    "@codemirror/lang-javascript": "^6.2.5",
    "@codemirror/lang-json": "^6.0.2",
    "@codemirror/lang-markdown": "^6.5.0",
    "@codemirror/lang-python": "^6.2.1",
    "@codemirror/language": "^6.12.3",
    "@codemirror/state": "^6.6.0",
    "@codemirror/theme-one-dark": "^6.1.3",
    "@codemirror/view": "^6.43.0",
    "@fontsource-variable/geist": "^5.2.9",
    "@fontsource-variable/geist-mono": "^5.2.8",
    "@hono/node-server": "^1.13.8",
    "@hono/zod-validator": "^0.8.0",
    "@hugeicons/core-free-icons": "^4.1.4",
    "@hugeicons/vue": "^1.0.5",
    "@lucide/vue": "^1.16.0",
    "@pierre/diffs": "^1.2.2",
    "@pierre/trees": "^1.0.0-beta.4",
    "@tailwindcss/vite": "^4.3.0",
    "@tanstack/vue-query": "^5.100.13",
    "@tanstack/vue-table": "^8.21.3",
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "^22.15.21",
    "@types/qrcode": "^1.5.6",
    "@types/ws": "^8.5.14",
    "@vee-validate/zod": "^4.15.1",
    "@vitejs/plugin-vue": "^5.2.3",
    "@vueuse/core": "^14.3.0",
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/addon-webgl": "^0.18.0",
    "@xterm/xterm": "^5.5.0",
    "autocannon": "^8.0.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "concurrently": "^9.1.2",
    "drizzle-kit": "^0.31.10",
    "drizzle-orm": "^0.45.2",
    "embla-carousel-vue": "^8.6.0",
    "esbuild": "^0.25.12",
    "hono": "^4.7.10",
    "qrcode": "^1.5.4",
    "reka-ui": "^2.9.8",
    "shadcn-vue": "^2.7.3",
    "tailwind-merge": "^3.6.0",
    "tailwindcss": "^4.3.0",
    "terser": "^5.44.0",
    "tsx": "^4.19.4",
    "tw-animate-css": "^1.4.0",
    "typescript": "^5.8.3",
    "vanjs-core": "^1.6.0",
    "vaul-vue": "^0.4.1",
    "vee-validate": "^4.15.1",
    "vite": "^6.3.5",
    "vitest": "^3.1.3",
    "vue": "^3.5.13",
    "vue-input-otp": "^0.3.2",
    "vue-router": "^4.6.4",
    "vue-sonner": "^2.0.9",
    "zod": "^3.25.76"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add pnpm-workspace.yaml package.json
git commit -m "chore: add pnpm workspace root"
```

---

### Task 2: Create server package

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "@workbench/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "better-sqlite3": "^12.10.0",
    "node-pty": "^1.0.0",
    "ws": "^8.18.2"
  }
}
```

- [ ] **Step 2: Create `server/tsconfig.json`**

```json
{
  "extends": "../tsconfig.build.json",
  "compilerOptions": {
    "baseUrl": ".."
  },
  "include": ["**/*.ts"],
  "exclude": ["**/*.test.ts", "**/*.spec.ts"]
}
```

- [ ] **Step 3: Commit**

```bash
git add server/package.json server/tsconfig.json
git commit -m "chore: add server workspace package"
```

---

### Task 3: Create cli package and update its server import

**Files:**
- Create: `cli/package.json`
- Create: `cli/tsconfig.json`
- Modify: `cli/index.ts`

- [ ] **Step 1: Create `cli/package.json`**

```json
{
  "name": "@workbench/cli",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "workbench-cli": "../../dist/cli/index.cjs"
  },
  "dependencies": {
    "@workbench/server": "workspace:*"
  }
}
```

- [ ] **Step 2: Create `cli/tsconfig.json`**

```json
{
  "extends": "../tsconfig.build.json",
  "compilerOptions": {
    "baseUrl": "..",
    "paths": {
      "@workbench/server": ["./server/index.ts"]
    }
  },
  "include": ["**/*.ts"],
  "exclude": ["**/*.test.ts", "**/*.spec.ts"]
}
```

- [ ] **Step 3: Update `cli/index.ts` import**

Change the import of `startServer` from the relative path to the workspace package name. Open `cli/index.ts` and replace:

```ts
import { startServer } from "../server/index.js";
```

with:

```ts
import { startServer } from "@workbench/server";
```

- [ ] **Step 4: Commit**

```bash
git add cli/package.json cli/tsconfig.json cli/index.ts
git commit -m "chore: add cli workspace package, import server via workspace dep"
```

---

### Task 4: Move frontend files

**Files:**
- Move: `src/` → `frontend/src/`
- Move: `index.html` → `frontend/index.html`
- Move: `public/` → `frontend/public/`
- Move: `vite.config.ts` → `frontend/vite.config.ts`
- Move: `components.json` → `frontend/components.json`
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`

- [ ] **Step 1: Move files**

```bash
mkdir -p frontend
mv src frontend/src
mv index.html frontend/index.html
mv public frontend/public
mv vite.config.ts frontend/vite.config.ts
mv components.json frontend/components.json
```

- [ ] **Step 2: Update `frontend/vite.config.ts`**

The two path changes needed:
1. Shiki shim imports: `./src/shims/...` stays the same (relative to `frontend/`)
2. `@server` alias: was `./server`, now `../server` (up one level from `frontend/`)
3. `isAllowedShikiLang` import: was `./src/shared/...`, stays the same
4. The `import.meta.url` references all stay relative to the file location

Find and replace these two alias lines in `frontend/vite.config.ts`:

```ts
// BEFORE
      {
        find: "@server",
        replacement: fileURLToPath(new URL("./server", import.meta.url)),
      },
```

```ts
// AFTER
      {
        find: "@server",
        replacement: fileURLToPath(new URL("../server", import.meta.url)),
      },
```

- [ ] **Step 3: Create `frontend/package.json`**

```json
{
  "name": "@workbench/frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module"
}
```

- [ ] **Step 4: Create `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "jsx": "preserve",
    "lib": ["ESNext", "DOM"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@server/*": ["../server/*"]
    }
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/ components.json index.html public/ src/ vite.config.ts
git commit -m "chore: move frontend files into frontend/ workspace package"
```

---

### Task 5: Update root configs and scripts

**Files:**
- Rewrite: `tsconfig.json`
- Rewrite: `tsconfig.build.json`
- Modify: `scripts/build-server.mjs`
- Modify: `scripts/package-release.mjs`

- [ ] **Step 1: Rewrite root `tsconfig.json`**

The root tsconfig is now only used for editor/tooling at the workspace level. Frontend has its own. Server and CLI are included for IDE navigation.

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "jsx": "preserve",
    "lib": ["ESNext", "DOM"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./frontend/src/*"],
      "@server/*": ["./server/*"],
      "@workbench/server": ["./server/index.ts"]
    }
  },
  "include": ["frontend/src", "server", "cli", "frontend/vite.config.ts", "scripts"]
}
```

- [ ] **Step 2: Rewrite root `tsconfig.build.json`**

No path changes needed — `server` and `cli` are still at root. Only update `baseUrl` to ensure `@workbench/server` resolves correctly for the build typecheck.

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "declaration": false,
    "lib": ["ESNext"],
    "baseUrl": ".",
    "paths": {
      "@workbench/server": ["./server/index.ts"]
    }
  },
  "include": ["server", "cli"],
  "exclude": ["**/*.test.ts", "**/*.spec.ts"]
}
```

- [ ] **Step 3: Update `scripts/build-server.mjs`**

The esbuild entrypoint is `cli/index.ts` which now imports `@workbench/server`. esbuild resolves this via the node_modules symlink pnpm creates. No entrypoint change needed.

Add a `tsconfig` option to esbuild so it picks up the `@workbench/server` path mapping:

Find the `await esbuild.build({` call and add `tsconfig: "tsconfig.build.json"` to the options:

```js
await esbuild.build({
  entryPoints: ["cli/index.ts"],
  outfile,
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  tsconfig: "tsconfig.build.json",   // ADD THIS LINE
  minify: true,
  // ... rest unchanged
```

- [ ] **Step 4: Update `scripts/package-release.mjs`**

The release script reads `package.json` to get runtime dependencies. These now live in `server/package.json`. Find the line that reads the root `package.json` and update it to read from `server/package.json`:

```js
// BEFORE
    dependencies: JSON.parse(readFileSync(join(root, "package.json"), "utf8")).dependencies,
```

```js
// AFTER
    dependencies: JSON.parse(readFileSync(join(root, "server", "package.json"), "utf8")).dependencies,
```

- [ ] **Step 5: Commit**

```bash
git add tsconfig.json tsconfig.build.json scripts/build-server.mjs scripts/package-release.mjs
git commit -m "chore: update root tsconfigs and scripts for monorepo layout"
```

---

### Task 6: Install and verify

- [ ] **Step 1: Install pnpm if not present**

```bash
npm install -g pnpm
```

- [ ] **Step 2: Remove old lock file and node_modules, then install with pnpm**

```bash
rm -f package-lock.json
rm -rf node_modules
pnpm install
```

Expected: pnpm creates `node_modules/.pnpm/`, symlinks `@workbench/server` and `@workbench/cli` into root `node_modules/@workbench/`, creates `pnpm-lock.yaml`.

- [ ] **Step 3: Verify typecheck passes**

```bash
pnpm typecheck
```

Expected: `tsc` exits 0 with no errors.

- [ ] **Step 4: Verify dev server starts**

```bash
pnpm dev
```

Expected: Server starts, Vite dev middleware loads, no import errors in console.

- [ ] **Step 5: Verify test suite passes**

```bash
pnpm test
```

Expected: All existing tests pass.

- [ ] **Step 6: Verify production build**

```bash
pnpm build
```

Expected: `dist/cli/index.cjs` produced, `dist/public/` produced, no bundle errors.

- [ ] **Step 7: Commit**

```bash
git add pnpm-lock.yaml
git rm package-lock.json 2>/dev/null || true
git commit -m "chore: migrate to pnpm workspace, remove npm lock file"
```

---

## Self-Review

**Spec coverage:**
- ✅ `frontend/` — `src/` moved + `index.html`, `public/`, `vite.config.ts`, `components.json`
- ✅ `server/` — existing folder, now has `package.json` with runtime deps
- ✅ `server-rs/` — untouched (Rust, no Node package needed)
- ✅ `cli/` — existing folder, now imports server via workspace dep
- ✅ pnpm monorepo — `pnpm-workspace.yaml` + per-package `package.json`

**Key invariants preserved:**
- esbuild entry `cli/index.ts` → `dist/cli/index.cjs` unchanged
- Vite output `dist/public/` unchanged
- All `package-release.mjs` logic unchanged except deps source
- `@server/*` alias still resolves to `server/` directory
- `@/*` alias still resolves to Vue `src/` (now at `frontend/src/`)
