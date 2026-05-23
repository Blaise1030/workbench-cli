# LAN Terminal Security & CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the LAN terminal with TLS, HttpOnly cookie auth, session limits, token expiry, and package it as a distributable `npx`/`brew` CLI.

**Architecture:** The Hono app is extracted to `server/app.ts` (exported factory, testable via `app.request()`), `server/index.ts` handles HTTPS startup, and `cli/index.ts` orchestrates mkcert setup then starts the server. Token and session state are separate modules with injectable dependencies for testability.

**Tech Stack:** Vue 3 + shadcn-vue, Hono + @hono/node-server, node-pty, node:https, mkcert (external CLI), vitest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `cli/index.ts` | CLI entry point — runs TLS setup, starts server, prints URL |
| Create | `server/app.ts` | Hono app factory — all routes including `POST /auth` |
| Create | `server/tls.ts` | mkcert detection, install, cert generation, cert caching |
| Create | `server/session.ts` | Session state: create sid, activate, deactivate, validate |
| Create | `server/tls.test.ts` | Tests for tls.ts |
| Create | `server/session.test.ts` | Tests for session.ts |
| Create | `server/app.test.ts` | Tests for POST /auth route |
| Create | `src/components/Login.vue` | shadcn-vue login card (token input + submit) |
| Modify | `server/token.ts` | Replace `consumed` flag with `expiresAt`; use 32-byte hex |
| Modify | `server/token.test.ts` | Add expiry tests |
| Modify | `server/index.ts` | Switch to HTTPS, import app from app.ts, update WS to cookie auth |
| Modify | `src/App.vue` | Auth state machine — show Login or Terminal |
| Modify | `src/components/Terminal.vue` | Remove token prop; connect via cookie |
| Modify | `package.json` | Add bin, update scripts, add tsconfig.build.json reference |
| Modify | `vite.config.ts` | Proxy /auth + /ws to https in dev mode |
| Create | `tsconfig.build.json` | tsc build config for cli/ + server/ → dist/ |

---

## Task 1: Run shadcn-vue init

**Files:**
- Modifies: `vite.config.ts`, `package.json`, `src/` (adds components.json, lib/utils.ts, tailwind config)

- [ ] **Step 1: Run the shadcn-vue preset init**

```bash
cd /Users/blaisetiong/Developer/v2
npx shadcn-vue@latest init --preset a2LMozI --template vite
```

Accept all prompts. This installs Tailwind, adds `components.json`, creates `src/lib/utils.ts`, and may update `vite.config.ts`.

- [ ] **Step 2: Verify the setup compiled**

```bash
npx vite build --mode development 2>&1 | tail -5
```

Expected: no errors (warnings about unused vars are OK).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: init shadcn-vue with preset a2LMozI"
```

---

## Task 2: Build config — tsconfig.build.json + package.json

**Files:**
- Create: `tsconfig.build.json`
- Modify: `package.json`
- Modify: `tsconfig.json`

- [ ] **Step 1: Add cli/ to the base tsconfig include**

In `tsconfig.json`, change `"include"` to:
```json
"include": ["src", "server", "cli", "vite.config.ts"]
```

- [ ] **Step 2: Create tsconfig.build.json**

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
    "lib": ["ESNext"]
  },
  "include": ["server", "cli"]
}
```

- [ ] **Step 3: Update package.json scripts and bin**

Replace the `"scripts"` and add `"bin"` in `package.json`:

```json
"bin": {
  "lan-terminal": "dist/cli/index.js"
},
"scripts": {
  "dev": "concurrently \"vite\" \"tsx watch server/index.ts\"",
  "build": "tsc -p tsconfig.build.json && vite build",
  "start": "node dist/cli/index.js",
  "test": "vitest run",
  "prepublishOnly": "npm run build"
},
```

- [ ] **Step 4: Verify tsc finds the new config**

```bash
npx tsc -p tsconfig.build.json --noEmit 2>&1 | head -20
```

Expected: errors only about missing `cli/index.ts` (which we haven't created yet) — no config errors.

- [ ] **Step 5: Commit**

```bash
git add tsconfig.json tsconfig.build.json package.json
git commit -m "chore: add build tsconfig and bin entry for CLI"
```

---

## Task 3: Refactor server/token.ts — expiry support

**Files:**
- Modify: `server/token.ts`
- Modify: `server/token.test.ts`

- [ ] **Step 1: Write failing tests for expiry**

Replace the contents of `server/token.test.ts` with:

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { createToken, isTokenValid, isTokenExpired } from "./token.js";

afterEach(() => vi.useRealTimers());

describe("createToken", () => {
  it("returns a 64-char hex string", () => {
    const token = createToken();
    expect(token.value).toMatch(/^[0-9a-f]{64}$/);
  });

  it("sets expiresAt one hour from now", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const token = createToken();
    expect(token.expiresAt).toBe(3_600_000);
  });

  it("returns unique values each call", () => {
    expect(createToken().value).not.toBe(createToken().value);
  });
});

describe("isTokenValid", () => {
  it("returns true for correct value before expiry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const token = createToken();
    expect(isTokenValid(token, token.value)).toBe(true);
  });

  it("returns false for wrong value", () => {
    const token = createToken();
    expect(isTokenValid(token, "wrong")).toBe(false);
  });

  it("returns false after expiry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const token = createToken();
    vi.setSystemTime(3_600_001);
    expect(isTokenValid(token, token.value)).toBe(false);
  });
});

describe("isTokenExpired", () => {
  it("returns false before expiry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const token = createToken();
    vi.setSystemTime(3_599_999);
    expect(isTokenExpired(token)).toBe(false);
  });

  it("returns true at or after expiry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const token = createToken();
    vi.setSystemTime(3_600_000);
    expect(isTokenExpired(token)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run server/token.test.ts 2>&1 | tail -15
```

Expected: FAIL — `isTokenValid`, `isTokenExpired` not exported.

- [ ] **Step 3: Rewrite server/token.ts**

```typescript
import { randomBytes } from "node:crypto";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface SessionToken {
  value: string;
  expiresAt: number;
}

export function createToken(): SessionToken {
  return {
    value: randomBytes(32).toString("hex"),
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
}

export function isTokenExpired(token: SessionToken): boolean {
  return Date.now() >= token.expiresAt;
}

export function isTokenValid(token: SessionToken, input: string): boolean {
  return !isTokenExpired(token) && input === token.value;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run server/token.test.ts 2>&1 | tail -10
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/token.ts server/token.test.ts
git commit -m "refactor: replace consumed flag with expiry in SessionToken"
```

---

## Task 4: New server/session.ts — session state

**Files:**
- Create: `server/session.ts`
- Create: `server/session.test.ts`

- [ ] **Step 1: Write failing tests**

Create `server/session.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createSession, activateSession, deactivateSession, validateSession } from "./session.js";

describe("createSession", () => {
  it("returns a 64-char hex sid, inactive by default", () => {
    const session = createSession();
    expect(session.sid).toMatch(/^[0-9a-f]{64}$/);
    expect(session.active).toBe(false);
  });

  it("returns unique sids", () => {
    expect(createSession().sid).not.toBe(createSession().sid);
  });
});

describe("activateSession / deactivateSession", () => {
  it("activateSession sets active to true", () => {
    const session = createSession();
    activateSession(session);
    expect(session.active).toBe(true);
  });

  it("deactivateSession sets active to false", () => {
    const session = createSession();
    activateSession(session);
    deactivateSession(session);
    expect(session.active).toBe(false);
  });
});

describe("validateSession", () => {
  it("returns true for matching active sid", () => {
    const session = createSession();
    activateSession(session);
    expect(validateSession(session, session.sid)).toBe(true);
  });

  it("returns false for wrong sid", () => {
    const session = createSession();
    activateSession(session);
    expect(validateSession(session, "wrong")).toBe(false);
  });

  it("returns false when session is inactive", () => {
    const session = createSession();
    activateSession(session);
    deactivateSession(session);
    expect(validateSession(session, session.sid)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run server/session.test.ts 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement server/session.ts**

```typescript
import { randomBytes } from "node:crypto";

export interface Session {
  sid: string;
  active: boolean;
}

export function createSession(): Session {
  return { sid: randomBytes(32).toString("hex"), active: false };
}

export function activateSession(session: Session): void {
  session.active = true;
}

export function deactivateSession(session: Session): void {
  session.active = false;
}

export function validateSession(session: Session, sid: string): boolean {
  return session.active && session.sid === sid;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run server/session.test.ts 2>&1 | tail -10
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/session.ts server/session.test.ts
git commit -m "feat: add session state module with sid + active tracking"
```

---

## Task 5: New server/tls.ts — mkcert + cert caching

**Files:**
- Create: `server/tls.ts`
- Create: `server/tls.test.ts`

- [ ] **Step 1: Write failing tests**

Create `server/tls.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { parseCertPaths, isMkcertInstalled, buildCertArgs } from "./tls.js";

describe("parseCertPaths", () => {
  it("returns key and cert paths for given hosts", () => {
    const paths = parseCertPaths("/cache", "localhost", "192.168.1.10");
    expect(paths.certFile).toBe("/cache/192.168.1.10.pem");
    expect(paths.keyFile).toBe("/cache/192.168.1.10-key.pem");
  });

  it("uses only localhost when no LAN IP", () => {
    const paths = parseCertPaths("/cache", "localhost");
    expect(paths.certFile).toBe("/cache/localhost.pem");
    expect(paths.keyFile).toBe("/cache/localhost-key.pem");
  });
});

describe("buildCertArgs", () => {
  it("includes all hosts in mkcert args", () => {
    const args = buildCertArgs("/cache", "localhost", "192.168.1.10");
    expect(args).toContain("localhost");
    expect(args).toContain("192.168.1.10");
    expect(args).toContain("-cert-file");
    expect(args).toContain("-key-file");
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run server/tls.test.ts 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement server/tls.ts**

```typescript
import { execSync, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

export interface TLSCredentials {
  key: Buffer;
  cert: Buffer;
}

export interface CertPaths {
  certFile: string;
  keyFile: string;
}

export function parseCertPaths(cacheDir: string, ...hosts: string[]): CertPaths {
  const base = hosts[hosts.length - 1];
  return {
    certFile: join(cacheDir, `${base}.pem`),
    keyFile: join(cacheDir, `${base}-key.pem`),
  };
}

export function buildCertArgs(cacheDir: string, ...hosts: string[]): string[] {
  const { certFile, keyFile } = parseCertPaths(cacheDir, ...hosts);
  return ["-cert-file", certFile, "-key-file", keyFile, ...hosts];
}

export function isMkcertInstalled(): boolean {
  try {
    execSync("mkcert -version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function installMkcert(): void {
  const os = platform();
  if (os === "darwin") {
    console.log("  Installing mkcert via brew...");
    execSync("brew install mkcert", { stdio: "inherit" });
  } else if (os === "linux") {
    console.log("  Installing mkcert via apt...");
    execSync("sudo apt-get install -y mkcert", { stdio: "inherit" });
  } else {
    throw new Error(
      "mkcert not found. Install it manually: https://github.com/FiloSottile/mkcert#installation"
    );
  }
}

export async function ensureTLS(lanIP: string): Promise<TLSCredentials> {
  if (!isMkcertInstalled()) {
    installMkcert();
  }

  // Install local CA (idempotent)
  execSync("mkcert -install", { stdio: "inherit" });

  const cacheDir = join(homedir(), ".lan-terminal", "certs");
  mkdirSync(cacheDir, { recursive: true });

  const hosts = ["localhost", lanIP];
  const { certFile, keyFile } = parseCertPaths(cacheDir, ...hosts);

  if (!existsSync(certFile) || !existsSync(keyFile)) {
    console.log(`  Generating cert for ${hosts.join(", ")}...`);
    execFileSync("mkcert", buildCertArgs(cacheDir, ...hosts), { stdio: "inherit" });
  }

  return {
    key: readFileSync(keyFile),
    cert: readFileSync(certFile),
  };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run server/tls.test.ts 2>&1 | tail -10
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/tls.ts server/tls.test.ts
git commit -m "feat: add tls.ts with mkcert detection, cert generation, and caching"
```

---

## Task 6: New server/app.ts — Hono app with POST /auth

**Files:**
- Create: `server/app.ts`
- Create: `server/app.test.ts`

- [ ] **Step 1: Write failing tests**

Create `server/app.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { vi } from "vitest";
import { createApp } from "./app.js";
import { createToken } from "./token.js";
import { createSession } from "./session.js";

describe("POST /auth", () => {
  it("returns 401 for wrong token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const token = createToken();
    const session = createSession();
    const app = createApp(token, session);
    const res = await app.request("/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "wrong" }),
    });
    expect(res.status).toBe(401);
    vi.useRealTimers();
  });

  it("returns 401 with expiry message when token is expired", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const token = createToken();
    const session = createSession();
    const app = createApp(token, session);
    vi.setSystemTime(3_600_001);
    const res = await app.request("/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.value }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/expired/i);
    vi.useRealTimers();
  });

  it("returns 409 when a session is already active", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const token = createToken();
    const session = createSession();
    session.active = true; // simulate existing active session
    const app = createApp(token, session);
    const res = await app.request("/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.value }),
    });
    expect(res.status).toBe(409);
    vi.useRealTimers();
  });

  it("returns 200 and sets sid cookie for valid token and no active session", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const token = createToken();
    const session = createSession();
    const app = createApp(token, session);
    const res = await app.request("/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.value }),
    });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("sid=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    expect(session.active).toBe(true);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run server/app.test.ts 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement server/app.ts**

```typescript
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { serveStatic } from "@hono/node-server/serve-static";
import { SessionToken, isTokenValid, isTokenExpired } from "./token.js";
import { Session, activateSession } from "./session.js";

export function createApp(token: SessionToken, session: Session): Hono {
  const app = new Hono();

  app.post("/auth", async (c) => {
    const body = await c.req.json<{ token?: string }>();
    const input = body?.token ?? "";

    if (!isTokenValid(token, input)) {
      if (isTokenExpired(token)) {
        return c.json({ error: "Token expired — restart the server" }, 401);
      }
      return c.json({ error: "Invalid token" }, 401);
    }

    if (session.active) {
      return c.json({ error: "Another session is already active" }, 409);
    }

    activateSession(session);

    setCookie(c, "sid", session.sid, {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      maxAge: 3600,
      path: "/",
    });

    return c.json({ ok: true });
  });

  app.use("/*", serveStatic({ root: "./dist/public" }));

  return app;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run server/app.test.ts 2>&1 | tail -10
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/app.ts server/app.test.ts
git commit -m "feat: add Hono app factory with POST /auth and cookie session"
```

---

## Task 7: Rewrite server/index.ts — HTTPS + cookie WS auth

**Files:**
- Modify: `server/index.ts`

- [ ] **Step 1: Replace server/index.ts entirely**

```typescript
import { createServer } from "node:https";
import { serve } from "@hono/node-server";
import { networkInterfaces } from "node:os";
import { WebSocketServer, WebSocket } from "ws";
import * as pty from "node-pty";
import { createToken } from "./token.js";
import { createSession, validateSession, deactivateSession } from "./session.js";
import { createApp } from "./app.js";
import { parseResize } from "./pty.js";
import type { TLSCredentials } from "./tls.js";

export function getLanIP(): string {
  const nets = networkInterfaces();
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "127.0.0.1";
}

function parseSid(cookieHeader: string | undefined): string {
  if (!cookieHeader) return "";
  const match = cookieHeader.match(/(?:^|;\s*)sid=([^;]+)/);
  return match?.[1] ?? "";
}

export function startServer(tls: TLSCredentials, port = 3000): void {
  const sessionToken = createToken();
  const session = createSession();
  const app = createApp(sessionToken, session);

  const server = serve({
    fetch: app.fetch,
    port,
    hostname: "0.0.0.0",
    createServer: (opts: object, handler: (...args: unknown[]) => void) =>
      createServer({ ...opts, ...tls }, handler),
  } as Parameters<typeof serve>[0]);

  const lanIP = getLanIP();
  console.log(`\n  Access token: ${sessionToken.value}`);
  console.log(`  Open: https://${lanIP}:${port}/\n`);

  const wss = new WebSocketServer({ noServer: true });

  function handlePTYConnection(ws: WebSocket): void {
    const shell = process.env.SHELL ?? "/bin/zsh";
    let ptyProcess: pty.IPty | null = null;

    ws.on("message", (msg: Buffer | string) => {
      const input = typeof msg === "string" ? msg : msg.toString("utf-8");
      const resize = parseResize(input);

      if (resize) {
        if (!ptyProcess) {
          const env: Record<string, string> = {};
          for (const [k, v] of Object.entries(process.env)) {
            if (v !== undefined) env[k] = v;
          }
          try {
            ptyProcess = pty.spawn(shell, ["-l"], {
              name: "xterm-256color",
              cols: resize.cols,
              rows: resize.rows,
              cwd: process.env.HOME ?? "/",
              env,
            });
          } catch (err) {
            console.error("PTY spawn failed:", err);
            if (ws.readyState === WebSocket.OPEN) ws.close();
            return;
          }
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
      deactivateSession(session);
    });
  }

  (server as import("http").Server).on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "https://localhost");
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }

    const sid = parseSid(req.headers.cookie);
    if (!validateSession(session, sid)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => handlePTYConnection(ws));
  });
}
```

- [ ] **Step 2: Run all server tests**

```bash
npx vitest run server/ 2>&1 | tail -15
```

Expected: all tests PASS (pty.test, token.test, session.test, app.test, tls.test).

- [ ] **Step 3: Commit**

```bash
git add server/index.ts
git commit -m "feat: rewrite server to HTTPS with cookie-based WebSocket auth"
```

---

## Task 8: New cli/index.ts — CLI entrypoint

**Files:**
- Create: `cli/index.ts`

- [ ] **Step 1: Create cli/index.ts**

```typescript
#!/usr/bin/env node
import { ensureTLS } from "../server/tls.js";
import { getLanIP, startServer } from "../server/index.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

async function main(): Promise<void> {
  const lanIP = getLanIP();
  console.log("\n  lan-terminal starting...");
  console.log(`  Detected LAN IP: ${lanIP}`);

  let tls;
  try {
    tls = await ensureTLS(lanIP);
  } catch (err) {
    console.error("\n  TLS setup failed:", (err as Error).message);
    process.exit(1);
  }

  startServer(tls, PORT);
}

main();
```

- [ ] **Step 2: Verify tsc compiles without errors**

```bash
npx tsc -p tsconfig.build.json --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add cli/index.ts
git commit -m "feat: add CLI entrypoint with TLS setup and server start"
```

---

## Task 9: Update vite.config.ts — HTTPS proxy for dev

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Update vite.config.ts proxy targets to https**

Replace the `proxy` section in `vite.config.ts`:

```typescript
proxy: {
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
```

Also update the dev script port in server/index.ts for dev mode — add this at the top of `startServer`:

In `server/index.ts`, update the `serve` call to read the port from an env var for dev:

The `PORT` is already passed as a parameter to `startServer`, so the dev script in `package.json` should be:
```json
"dev": "concurrently \"vite\" \"tsx watch server/index.ts\""
```

And `server/index.ts` should be runnable directly — add a direct-run block at the bottom of `server/index.ts`:

```typescript
// Direct run (dev mode via tsx)
if (process.argv[1] && process.argv[1].endsWith("index.ts")) {
  import("./tls.js").then(({ ensureTLS }) => {
    const port = parseInt(process.env.PORT ?? "3001", 10);
    ensureTLS(getLanIP()).then((tls) => startServer(tls, port));
  });
}
```

- [ ] **Step 2: Verify dev mode starts without errors**

```bash
npx vite build 2>&1 | tail -5
```

Expected: build completes successfully.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts server/index.ts
git commit -m "chore: update vite proxy to https and add dev direct-run block"
```

---

## Task 10: Frontend — Login.vue

**Files:**
- Create: `src/components/Login.vue`

- [ ] **Step 1: Add required shadcn-vue components**

```bash
npx shadcn-vue@latest add card input button
```

- [ ] **Step 2: Create src/components/Login.vue**

```vue
<script setup lang="ts">
import { ref } from "vue";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const emit = defineEmits<{ authenticated: [] }>();

const token = ref("");
const error = ref("");
const loading = ref(false);

async function submit() {
  error.value = "";
  loading.value = true;
  try {
    const res = await fetch("/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.value }),
    });
    if (res.ok) {
      emit("authenticated");
      return;
    }
    const body = await res.json().catch(() => ({}));
    if (res.status === 409) {
      error.value = "Another session is already active.";
    } else if (res.status === 401 && body.error?.includes("expired")) {
      error.value = "Token expired — restart the server.";
    } else {
      error.value = "Invalid token.";
    }
  } catch {
    error.value = "Could not reach server.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-background">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle>lan-terminal</CardTitle>
        <CardDescription>Enter the access token printed in your terminal.</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="flex flex-col gap-3" @submit.prevent="submit">
          <Input
            v-model="token"
            type="password"
            placeholder="Access token"
            autocomplete="off"
            autofocus
          />
          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
          <Button type="submit" :disabled="loading || !token">
            {{ loading ? "Connecting…" : "Connect" }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Login.vue
git commit -m "feat: add Login.vue with token form and error states"
```

---

## Task 11: Update App.vue + Terminal.vue

**Files:**
- Modify: `src/App.vue`
- Modify: `src/components/Terminal.vue`

- [ ] **Step 1: Rewrite src/App.vue**

```vue
<script setup lang="ts">
import { ref } from "vue";
import Login from "./components/Login.vue";
import Terminal from "./components/Terminal.vue";

const authenticated = ref(false);
</script>

<template>
  <Login v-if="!authenticated" @authenticated="authenticated = true" />
  <Terminal v-else style="width: 100%; height: 100vh;" />
</template>
```

- [ ] **Step 2: Update src/components/Terminal.vue — remove token prop**

Replace the `<script setup>` block in `src/components/Terminal.vue`:

```vue
<script setup lang="ts">
import { ref } from "vue";
import { Terminal as WTerm, type WTerm as WTermInstance } from "@wterm/vue";
import "@wterm/vue/css";

const termRef = ref<InstanceType<typeof WTerm> | null>(null);
const wsRef = ref<WebSocket | null>(null);

function onReady(wt: WTermInstance) {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${proto}//${location.host}/ws`);
  wsRef.value = ws;

  ws.onopen = () => {
    ws.send(`\x1b[RESIZE:${wt.cols};${wt.rows}]`);
  };

  ws.onmessage = (event: MessageEvent<string>) => {
    termRef.value?.write(event.data);
  };

  ws.onclose = () => {
    termRef.value?.write("\r\n\x1b[90m[session ended — reload to reconnect]\x1b[0m\r\n");
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
```

Keep the `<template>` block unchanged.

- [ ] **Step 3: Run all tests**

```bash
npx vitest run 2>&1 | tail -15
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/App.vue src/components/Terminal.vue
git commit -m "feat: update frontend to cookie auth — remove token from URL and props"
```

---

## Task 12: Full build verification

- [ ] **Step 1: Run full build**

```bash
npm run build 2>&1 | tail -20
```

Expected: `tsc` compiles without errors, Vite builds `dist/public/`.

- [ ] **Step 2: Verify bin entrypoint exists**

```bash
ls dist/cli/index.js
```

Expected: file exists.

- [ ] **Step 3: Run all tests one final time**

```bash
npm test 2>&1 | tail -15
```

Expected: all tests PASS.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete LAN terminal security hardening and CLI packaging"
```
