# LAN Web Terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Hono server that exposes a PTY-backed shell session over WebSocket to a Vue + wterm frontend, accessible to any device on the LAN via a one-time session token.

**Architecture:** Single monorepo — Hono on port 3001 (dev) or 3000 (prod) handles WebSocket upgrades and static file serving; Vite dev server on port 5173 proxies `/ws` to Hono in dev mode. A one-time UUID token is printed to stdout on startup; WebSocket connections that present an invalid or already-consumed token are rejected with 401.

**Tech Stack:** Node.js 24+, TypeScript, Hono + @hono/node-server, ws, node-pty, @wterm/vue + @wterm/dom, Vue 3, Vite, vitest, tsx, concurrently

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` | Scripts, dependencies |
| `tsconfig.json` | TypeScript config (shared client + server) |
| `vite.config.ts` | Vite build + `/ws` proxy to Hono in dev |
| `index.html` | Entry HTML for Vite |
| `src/main.ts` | Vue app mount |
| `src/App.vue` | Reads `?token` from URL, renders `<Terminal>` full-screen |
| `src/components/Terminal.vue` | wterm component, WebSocket connection, PTY protocol |
| `server/token.ts` | Pure token creation + validation logic |
| `server/pty.ts` | RESIZE message parser (pure function) |
| `server/index.ts` | Hono HTTP server, WS upgrade handler, PTY bridge |
| `server/token.test.ts` | Unit tests for token.ts |
| `server/pty.test.ts` | Unit tests for pty.ts |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

> **Note:** `node-pty` compiles native bindings. You need Python 3, make, and a C++ compiler. On macOS: Xcode Command Line Tools (`xcode-select --install`). On Linux: `build-essential`. The `npm install` step will take ~30 seconds.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "lan-terminal",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "concurrently \"vite\" \"tsx watch server/index.ts\"",
    "build": "vite build",
    "start": "NODE_ENV=production tsx server/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.8",
    "@wterm/dom": "^0.1.0",
    "@wterm/vue": "^0.1.0",
    "hono": "^4.7.10",
    "node-pty": "^1.0.0",
    "vue": "^3.5.13",
    "ws": "^8.18.2"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.3",
    "@types/node": "^22.15.21",
    "@types/ws": "^8.5.14",
    "concurrently": "^9.1.2",
    "tsx": "^4.19.4",
    "typescript": "^5.8.3",
    "vite": "^6.3.5",
    "vitest": "^3.1.3"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "jsx": "preserve",
    "lib": ["ESNext", "DOM"]
  },
  "include": ["src", "server", "vite.config.ts"]
}
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
dist/
*.log
```

- [ ] **Step 4: Install dependencies**

```bash
npm install
```

Expected: several seconds of native compilation for `node-pty`. Should end with `added N packages`.

- [ ] **Step 5: Commit**

```bash
git init
git add package.json tsconfig.json .gitignore
git commit -m "chore: project scaffold"
```

---

## Task 2: Server Utilities (token + PTY parser)

**Files:**
- Create: `server/token.ts`
- Create: `server/pty.ts`
- Create: `server/token.test.ts`
- Create: `server/pty.test.ts`

- [ ] **Step 1: Write failing tests for token.ts**

Create `server/token.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createToken, validateToken } from "./token.js";

describe("createToken", () => {
  it("returns a non-empty string", () => {
    const token = createToken();
    expect(typeof token.value).toBe("string");
    expect(token.value.length).toBeGreaterThan(0);
    expect(token.consumed).toBe(false);
  });

  it("returns a different value each call", () => {
    expect(createToken().value).not.toBe(createToken().value);
  });
});

describe("validateToken", () => {
  it("accepts a valid unconsumed token and marks it consumed", () => {
    const token = createToken();
    expect(validateToken(token, token.value)).toBe(true);
    expect(token.consumed).toBe(true);
  });

  it("rejects a wrong value", () => {
    const token = createToken();
    expect(validateToken(token, "wrong")).toBe(false);
    expect(token.consumed).toBe(false);
  });

  it("rejects a second use of a consumed token", () => {
    const token = createToken();
    validateToken(token, token.value);
    expect(validateToken(token, token.value)).toBe(false);
  });
});
```

- [ ] **Step 2: Write failing tests for pty.ts**

Create `server/pty.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseResize } from "./pty.js";

describe("parseResize", () => {
  it("parses a valid RESIZE message", () => {
    expect(parseResize("\x1b[RESIZE:80;24]")).toEqual({ cols: 80, rows: 24 });
    expect(parseResize("\x1b[RESIZE:220;50]")).toEqual({ cols: 220, rows: 50 });
  });

  it("returns null for non-RESIZE input", () => {
    expect(parseResize("hello")).toBeNull();
    expect(parseResize("\x1b[RESIZE:abc;def]")).toBeNull();
    expect(parseResize("")).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests — verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './token.js'` and `Cannot find module './pty.js'`

- [ ] **Step 4: Implement `server/token.ts`**

```typescript
export interface SessionToken {
  value: string;
  consumed: boolean;
}

export function createToken(): SessionToken {
  return { value: crypto.randomUUID(), consumed: false };
}

export function validateToken(token: SessionToken, input: string): boolean {
  if (token.consumed || input !== token.value) return false;
  token.consumed = true;
  return true;
}
```

- [ ] **Step 5: Implement `server/pty.ts`**

```typescript
export function parseResize(msg: string): { cols: number; rows: number } | null {
  const match = msg.match(/^\x1b\[RESIZE:(\d+);(\d+)\]$/);
  if (!match) return null;
  return { cols: parseInt(match[1], 10), rows: parseInt(match[2], 10) };
}
```

- [ ] **Step 6: Run tests — verify they pass**

```bash
npm test
```

Expected: all 6 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add server/token.ts server/pty.ts server/token.test.ts server/pty.test.ts
git commit -m "feat: token + PTY resize parser with tests"
```

---

## Task 3: Hono HTTP Server + Token Startup

**Files:**
- Create: `server/index.ts`

- [ ] **Step 1: Create `server/index.ts`**

```typescript
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { WebSocketServer, WebSocket } from "ws";
import * as pty from "node-pty";
import { networkInterfaces } from "os";
import { createToken, validateToken } from "./token.js";
import { parseResize } from "./pty.js";

const isDev = process.env.NODE_ENV !== "production";
const PORT = parseInt(process.env.PORT ?? (isDev ? "3001" : "3000"), 10);

const sessionToken = createToken();

function getLanIP(): string {
  const nets = networkInterfaces();
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "localhost";
}

const app = new Hono();

if (!isDev) {
  app.use("/*", serveStatic({ root: "./dist" }));
}

const server = serve({ fetch: app.fetch, port: PORT, hostname: "0.0.0.0" });

const lanIP = getLanIP();
const openURL = `http://${lanIP}:${PORT}/?token=${sessionToken.value}`;
console.log(`\n  Access token: ${sessionToken.value}`);
console.log(`  Open: ${openURL}\n`);
```

- [ ] **Step 2: Start the server and verify startup output**

```bash
npm run dev
```

Expected output (both processes start):
```
  Access token: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  Open: http://192.168.x.x:3001/?token=xxxxxxxx-...
```

Vite also starts on port 5173. Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add server/index.ts
git commit -m "feat: Hono server with LAN IP detection and session token"
```

---

## Task 4: WebSocket + PTY Bridge

**Files:**
- Modify: `server/index.ts`

- [ ] **Step 1: Add the WS upgrade handler and PTY bridge to `server/index.ts`**

Add the following after the `console.log` lines at the end of `server/index.ts`:

```typescript
const wss = new WebSocketServer({ noServer: true });

function handlePTYConnection(ws: WebSocket): void {
  const shell = process.env.SHELL ?? "/bin/zsh";
  let ptyProcess: pty.IPty | null = null;

  function cleanEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) env[k] = v;
    }
    return env;
  }

  ws.on("message", (msg: Buffer | string) => {
    const input = typeof msg === "string" ? msg : msg.toString("utf-8");
    const resize = parseResize(input);

    if (resize) {
      if (!ptyProcess) {
        ptyProcess = pty.spawn(shell, ["-l"], {
          name: "xterm-256color",
          cols: resize.cols,
          rows: resize.rows,
          cwd: process.env.HOME ?? "/",
          env: cleanEnv(),
        });

        ptyProcess.onData((data) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(data);
        });

        ptyProcess.onExit(() => {
          if (ws.readyState === WebSocket.OPEN) ws.close();
        });
      } else {
        ptyProcess.resize(resize.cols, resize.rows);
      }
      return;
    }

    ptyProcess?.write(input);
  });

  ws.on("close", () => {
    ptyProcess?.kill();
  });
}

(server as import("http").Server).on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }

  const token = url.searchParams.get("token") ?? "";
  if (!validateToken(sessionToken, token)) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => handlePTYConnection(ws));
});
```

- [ ] **Step 2: Test the WebSocket endpoint manually**

Start the server:
```bash
NODE_ENV=development tsx server/index.ts
```

In a second terminal, connect to the WS with a bad token — expect rejection:
```bash
node -e "
const { WebSocket } = await import('ws');
const ws = new WebSocket('ws://localhost:3001/ws?token=bad');
ws.on('close', (code) => { console.log('closed', code); process.exit(); });
ws.on('error', (e) => { console.log('error', e.message); process.exit(); });
" --input-type=module
```

Expected: `closed 1006` or `error` — connection refused/destroyed.

Connect with the correct token (copy from server stdout):
```bash
node -e "
const { WebSocket } = await import('ws');
const ws = new WebSocket('ws://localhost:3001/ws?token=PASTE_TOKEN_HERE');
ws.on('open', () => {
  ws.send('\x1b[RESIZE:80;24]');
  setTimeout(() => { ws.send('echo hello\r'); }, 500);
  setTimeout(() => { ws.close(); process.exit(); }, 1500);
});
ws.on('message', (d) => process.stdout.write(d.toString()));
" --input-type=module
```

Expected: shell prompt appears, then `hello` echoed, then closes.

Connect again with the same token — expect rejection (token consumed):

Same command as the bad-token test but with the previously valid token. Expected: closed/rejected.

Stop the server with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add server/index.ts
git commit -m "feat: WebSocket upgrade handler with PTY bridge and token guard"
```

---

## Task 5: Vite + Vue Scaffold

**Files:**
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/App.vue`

- [ ] **Step 1: Create `vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
  optimizeDeps: {
    exclude: ["@wterm/dom", "@wterm/vue"],
  },
});
```

- [ ] **Step 2: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Terminal</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 100%; height: 100%; background: #1a1a1a; }
      #app { width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `src/main.ts`**

```typescript
import { createApp } from "vue";
import App from "./App.vue";

createApp(App).mount("#app");
```

- [ ] **Step 4: Create `src/App.vue`**

```vue
<script setup lang="ts">
import Terminal from "./components/Terminal.vue";

const token = new URLSearchParams(window.location.search).get("token") ?? "";
</script>

<template>
  <Terminal :token="token" style="width: 100%; height: 100vh;" />
</template>
```

- [ ] **Step 5: Verify Vite starts**

```bash
npx vite
```

Expected: Vite dev server on http://localhost:5173. No errors. Stop with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts index.html src/main.ts src/App.vue
git commit -m "feat: Vite + Vue scaffold with WS proxy"
```

---

## Task 6: Terminal.vue Component

**Files:**
- Create: `src/components/Terminal.vue`

- [ ] **Step 1: Create `src/components/Terminal.vue`**

```vue
<script setup lang="ts">
import { ref } from "vue";
import { Terminal as WTerm } from "@wterm/vue";
import type { WTerm as WTermInstance } from "@wterm/dom";
import "@wterm/vue/css";

const props = defineProps<{ token: string }>();

const termRef = ref<InstanceType<typeof WTerm> | null>(null);
const wsRef = ref<WebSocket | null>(null);

function onReady(wt: WTermInstance) {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(
    `${proto}//${location.host}/ws?token=${props.token}`
  );
  wsRef.value = ws;

  ws.onopen = () => {
    ws.send(`\x1b[RESIZE:${wt.cols};${wt.rows}]`);
  };

  ws.onmessage = (event: MessageEvent<string>) => {
    termRef.value?.write(event.data);
  };

  ws.onclose = () => {
    termRef.value?.write("\r\n\x1b[90m[session ended — restart server for a new token]\x1b[0m\r\n");
    wsRef.value = null;
  };
}

function onData(data: string) {
  if (wsRef.value?.readyState === WebSocket.OPEN) {
    wsRef.value.send(data);
  }
}

function onResize(cols: number, rows: number) {
  if (wsRef.value?.readyState === WebSocket.OPEN) {
    wsRef.value.send(`\x1b[RESIZE:${cols};${rows}]`);
  }
}
</script>

<template>
  <WTerm
    ref="termRef"
    auto-resize
    cursor-blink
    @ready="onReady"
    @data="onData"
    @resize="onResize"
    style="width: 100%; height: 100%;"
  />
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Terminal.vue
git commit -m "feat: Terminal.vue wterm component with WebSocket PTY bridge"
```

---

## Task 7: End-to-End Verification

- [ ] **Step 1: Start both dev servers**

In one terminal:
```bash
npm run dev
```

Expected: both Vite (port 5173) and Hono (port 3001) start. Token + URL printed to console.

- [ ] **Step 2: Open the printed URL in a browser**

Copy the `Open:` URL from stdout (e.g. `http://192.168.x.x:3001/...`) — **use the Hono port (3001)**, not Vite's 5173, for this test. Open it in a browser.

Expected: wterm terminal appears full-screen, shell prompt visible.

- [ ] **Step 3: Test shell interaction**

Type `echo hello` and press Enter.

Expected: `hello` printed.

Type `htop` or `vim` and press Enter.

Expected: full-screen TUI renders correctly.

Resize the browser window.

Expected: terminal columns/rows update without corruption.

- [ ] **Step 4: Test token rejection**

Open a second browser tab with a wrong token in the URL (change one character). Expected: terminal shows `[session ended — restart server for a new token]` immediately.

Open the original URL in a new tab (token already consumed). Expected: same message.

- [ ] **Step 5: Test production build**

```bash
npm run build
npm run start
```

Expected: server starts, serves on port 3000, same terminal behavior at the printed URL.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: LAN web terminal — complete"
```

---

## Troubleshooting

**`node-pty` fails to compile:** Run `xcode-select --install` (macOS) or `sudo apt install build-essential python3` (Linux), then `npm install` again.

**`@wterm/vue` import errors in Vite:** The `optimizeDeps.exclude` in `vite.config.ts` prevents Vite from pre-bundling the WASM package. If you still see errors, add `ssr: { noExternal: ['@wterm/vue', '@wterm/dom'] }` to `vite.config.ts`.

**`WTerm` type not found:** Try `import type { WTerm as WTermInstance } from "@wterm/core"` instead of `@wterm/dom`.

**Token printed but URL shows wrong IP:** Override with `LAN_IP=192.168.x.x tsx server/index.ts` and update `getLanIP()` to check `process.env.LAN_IP` first.
