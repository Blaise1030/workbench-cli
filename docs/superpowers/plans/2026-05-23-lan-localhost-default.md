# Localhost-First LAN & Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Default bind to `127.0.0.1` only; LAN exposure opt-in via a Settings page; single-use invite tokens in QR share URLs; navigation via **vue-router**.

**Architecture:** `server/invite.ts` owns invite mint/validate/consume. `server/lan.ts` owns bind mode + server rebind. `createApp()` gains session middleware and `/api/settings/lan*` routes. Frontend uses vue-router (`/login`, `/`, `/settings`) with a navigation guard that checks session via `GET /api/settings/lan` (401 → login).

**Tech Stack:** Vue 3, vue-router 4, shadcn-vue, Hono, node:https, mkcert, vitest, `qrcode`

**Spec:** `docs/superpowers/specs/2026-05-23-lan-localhost-default-design.md` (navigation updated to vue-router per user request)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `server/invite.ts` | Invite token mint, validate, consume (15 min, single-use) |
| Create | `server/invite.test.ts` | Invite unit tests |
| Create | `server/lan.ts` | `LanManager`: mode, rebind, invite lifecycle, URL builder |
| Create | `server/lan.test.ts` | LanManager unit tests (no real listen) |
| Create | `server/middleware.ts` | `requireSession` Hono middleware |
| Create | `src/router/index.ts` | Routes + auth guard |
| Create | `src/views/LoginView.vue` | Wraps Login (or inline login) |
| Create | `src/views/TerminalView.vue` | Terminal + header nav |
| Create | `src/views/SettingsView.vue` | Settings page |
| Create | `src/components/Settings.vue` | LAN switch + dialogs |
| Create | `src/components/LanShareCard.vue` | URL, copy, QR, regenerate |
| Modify | `server/tls.ts` | `ensureTLS(...hosts)` — localhost-only or localhost+LAN |
| Modify | `server/tls.test.ts` | Tests for variable host lists |
| Modify | `server/app.ts` | Invite in `/auth`, settings API, `requireSession` |
| Modify | `server/app.test.ts` | Invite auth + settings route tests |
| Modify | `server/index.ts` | `127.0.0.1` default, `LanManager` integration |
| Modify | `cli/index.ts` | Localhost URL only, localhost TLS |
| Modify | `src/main.ts` | `app.use(router)` |
| Modify | `src/App.vue` | `<RouterView />` only |
| Modify | `src/components/Login.vue` | `?invite=` auto-auth |
| Modify | `src/components/Terminal.vue` | Header with link to `/settings` |
| Modify | `vite.config.ts` | Proxy `/api` to backend |
| Modify | `package.json` | `vue-router`, `qrcode` |

---

## Task 1: Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime deps**

```bash
cd /Users/blaisetiong/Developer/v2
npm install vue-router@4 qrcode
npm install -D @types/qrcode
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add vue-router and qrcode dependencies"
```

---

## Task 2: Invite token module

**Files:**
- Create: `server/invite.ts`
- Create: `server/invite.test.ts`

- [ ] **Step 1: Write failing tests**

Create `server/invite.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createInvite,
  isInviteValid,
  consumeInvite,
  type InviteToken,
} from "./invite.js";

describe("invite", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is valid when fresh and unused", () => {
    const invite = createInvite();
    expect(isInviteValid(invite, invite.value)).toBe(true);
  });

  it("is invalid after consume", () => {
    const invite = createInvite();
    consumeInvite(invite);
    expect(isInviteValid(invite, invite.value)).toBe(false);
  });

  it("is invalid after 15 minutes", () => {
    const invite = createInvite();
    vi.setSystemTime(15 * 60 * 1000 + 1);
    expect(isInviteValid(invite, invite.value)).toBe(false);
  });

  it("is invalid for wrong input", () => {
    const invite = createInvite();
    expect(isInviteValid(invite, "wrong")).toBe(false);
  });

  it("is invalid when invite is null", () => {
    expect(isInviteValid(null, "anything")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- server/invite.test.ts
```

Expected: cannot find module `./invite.js`

- [ ] **Step 3: Implement `server/invite.ts`**

```ts
import { randomBytes } from "node:crypto";

const INVITE_TTL_MS = 15 * 60 * 1000;

export interface InviteToken {
  value: string;
  expiresAt: number;
  used: boolean;
}

export function createInvite(): InviteToken {
  return {
    value: randomBytes(32).toString("hex"),
    expiresAt: Date.now() + INVITE_TTL_MS,
    used: false,
  };
}

export function isInviteValid(invite: InviteToken | null, input: string): boolean {
  if (!invite || invite.used) return false;
  if (Date.now() >= invite.expiresAt) return false;
  return input === invite.value;
}

export function consumeInvite(invite: InviteToken): void {
  invite.used = true;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- server/invite.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add server/invite.ts server/invite.test.ts
git commit -m "feat: add single-use invite token module"
```

---

## Task 3: TLS variable hosts

**Files:**
- Modify: `server/tls.ts`
- Modify: `server/tls.test.ts`
- Modify: `cli/index.ts` (call site preview — full change in Task 7)
- Modify: `server/index.ts` dev block (call site — Task 8)

- [ ] **Step 1: Add failing test for localhost-only hosts**

In `server/tls.test.ts`, add:

```ts
it("buildCertArgs works with localhost only", () => {
  const args = buildCertArgs("/cache", "localhost");
  expect(args).toContain("localhost");
  expect(args).not.toContain("192.168.");
});
```

- [ ] **Step 2: Change `ensureTLS` signature**

Replace `ensureTLS(lanIP: string)` with:

```ts
export async function ensureTLS(...hosts: string[]): Promise<TLSCredentials> {
  if (hosts.length === 0) {
    throw new Error("ensureTLS requires at least one host");
  }
  // ... existing mkcert logic ...
  const { certFile, keyFile } = parseCertPaths(cacheDir, ...hosts);
  // regenerate if missing OR if host list changed (check all hosts in cert file name logic)
```

Use `hosts` array instead of hardcoded `["localhost", lanIP]`. Cert file naming stays keyed on last host in `parseCertPaths` — for localhost-only use `parseCertPaths(cacheDir, "localhost")`; for LAN use `parseCertPaths(cacheDir, "localhost", lanIP)` so cert file is named after LAN IP (existing behavior).

- [ ] **Step 3: Run tests**

```bash
npm test -- server/tls.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add server/tls.ts server/tls.test.ts
git commit -m "feat: support variable host lists in ensureTLS"
```

---

## Task 4: Session middleware

**Files:**
- Create: `server/middleware.ts`

- [ ] **Step 1: Implement middleware**

```ts
import type { Context, Next } from "hono";
import type { Session } from "./session.js";
import { validateSession } from "./session.js";

function parseSid(cookieHeader: string | undefined): string {
  if (!cookieHeader) return "";
  const match = cookieHeader.match(/(?:^|;\s*)sid=([^;]+)/);
  return match?.[1] ?? "";
}

export function requireSession(session: Session) {
  return async (c: Context, next: Next) => {
    const sid = parseSid(c.req.header("cookie"));
    if (!validateSession(session, sid)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add server/middleware.ts
git commit -m "feat: add requireSession Hono middleware"
```

---

## Task 5: LanManager (bind mode + invite, no rebind yet)

**Files:**
- Create: `server/lan.ts`
- Create: `server/lan.test.ts`

- [ ] **Step 1: Write failing tests for state/URL builder**

```ts
import { describe, it, expect } from "vitest";
import { LanManager } from "./lan.js";

describe("LanManager", () => {
  it("starts in localhost mode", () => {
    const lan = new LanManager(3000);
    expect(lan.mode).toBe("localhost");
    expect(lan.getPublicState().enabled).toBe(false);
  });

  it("buildLanUrl includes invite when enabled", () => {
    const lan = new LanManager(3000);
    lan.enable("192.168.1.10");
    const state = lan.getPublicState();
    expect(state.enabled).toBe(true);
    expect(state.lanUrl).toMatch(/^https:\/\/192\.168\.1\.10:3000\/\?invite=/);
    expect(state.inviteExpiresAt).toBeGreaterThan(Date.now());
  });

  it("disable clears invite and mode", () => {
    const lan = new LanManager(3000);
    lan.enable("192.168.1.10");
    lan.disable();
    expect(lan.mode).toBe("localhost");
    expect(lan.getInvite()).toBeNull();
  });

  it("refreshInvite invalidates previous value", () => {
    const lan = new LanManager(3000);
    lan.enable("192.168.1.10");
    const first = lan.getInvite()!.value;
    lan.refreshInvite();
    expect(lan.getInvite()!.value).not.toBe(first);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- server/lan.test.ts
```

- [ ] **Step 3: Implement `server/lan.ts`**

```ts
import { createInvite, type InviteToken } from "./invite.js";

export type BindMode = "localhost" | "lan";

export interface LanPublicState {
  enabled: boolean;
  lanUrl?: string;
  inviteExpiresAt?: number;
}

export class LanManager {
  mode: BindMode = "localhost";
  private invite: InviteToken | null = null;
  private lanIP: string | null = null;

  constructor(private readonly port: number) {}

  enable(lanIP: string): void {
    this.mode = "lan";
    this.lanIP = lanIP;
    this.invite = createInvite();
  }

  disable(): void {
    this.mode = "localhost";
    this.lanIP = null;
    this.invite = null;
  }

  refreshInvite(): InviteToken {
    if (this.mode !== "lan" || !this.lanIP) {
      throw new Error("LAN is not enabled");
    }
    this.invite = createInvite();
    return this.invite;
  }

  getInvite(): InviteToken | null {
    return this.invite;
  }

  getHostname(): string {
    return this.mode === "lan" ? "0.0.0.0" : "127.0.0.1";
  }

  getTlsHosts(): string[] {
    return this.mode === "lan" && this.lanIP
      ? ["localhost", this.lanIP]
      : ["localhost"];
  }

  getPublicState(): LanPublicState {
    if (this.mode !== "lan" || !this.lanIP || !this.invite) {
      return { enabled: false };
    }
    return {
      enabled: true,
      lanUrl: `https://${this.lanIP}:${this.port}/?invite=${this.invite.value}`,
      inviteExpiresAt: this.invite.expiresAt,
    };
  }
}
```

- [ ] **Step 4: Run tests — PASS**

```bash
npm test -- server/lan.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add server/lan.ts server/lan.test.ts
git commit -m "feat: add LanManager state and share URL builder"
```

---

## Task 6: App routes — invite auth + settings API

**Files:**
- Modify: `server/app.ts`
- Modify: `server/app.test.ts`

- [ ] **Step 1: Extend `createApp` signature**

```ts
import type { LanManager } from "./lan.js";
import { isInviteValid, consumeInvite } from "./invite.js";
import { requireSession } from "./middleware.js";

export function createApp(
  token: SessionToken,
  session: Session,
  lan: LanManager,
): Hono {
```

- [ ] **Step 2: Update `POST /auth` to accept invite**

After parsing body, before startup token check:

```ts
const invite = lan.getInvite();
if (isInviteValid(invite, input)) {
  if (session.active) {
    return c.json({ error: "Another session is already active" }, 409);
  }
  consumeInvite(invite!);
  activateSession(session);
  setCookie(c, "sid", session.sid, { /* unchanged */ });
  return c.json({ ok: true });
}
// existing startup token validation...
```

Add invite-specific 401 messages when input matches used/expired invite (optional refinement in tests).

- [ ] **Step 3: Add settings routes**

```ts
const settings = new Hono();
settings.use("*", requireSession(session));

settings.get("/lan", (c) => {
  return c.json(lan.getPublicState());
});

settings.post("/lan", async (c) => {
  const body = await c.req.json<{ enabled?: boolean }>();
  // enabled true/false handled by caller (index.ts) for rebind;
  // here only update lan state when called from tests OR split:
  // For tests: call lan.enable/disable directly and return getPublicState()
  return c.json({ ok: true, ...lan.getPublicState() });
});
```

**Note for implementer:** Rebind side effects live in `server/index.ts` — the POST handler should call `onLanToggle(enabled)` callback injected into `createApp`:

```ts
export function createApp(
  token: SessionToken,
  session: Session,
  lan: LanManager,
  onLanToggle: (enabled: boolean) => Promise<void>,
): Hono
```

POST `/api/settings/lan`:

```ts
settings.post("/lan", async (c) => {
  const { enabled } = await c.req.json<{ enabled: boolean }>();
  if (enabled && !getLanIP()) {
    return c.json({ error: "No network interface found" }, 503);
  }
  try {
    await onLanToggle(enabled);
  } catch {
    return c.json({ error: "Failed to change network mode" }, 500);
  }
  return c.json(lan.getPublicState());
});

settings.post("/lan/refresh-invite", async (c) => {
  if (lan.mode !== "lan") {
    return c.json({ error: "LAN is not enabled" }, 400);
  }
  lan.refreshInvite();
  return c.json(lan.getPublicState());
});
```

Mount: `app.route("/api/settings", settings);`

- [ ] **Step 4: Add app tests**

In `server/app.test.ts`:

```ts
it("authenticates with valid invite token", async () => {
  const token = createToken();
  const session = createSession();
  const lan = new LanManager(3000);
  lan.enable("192.168.1.10");
  const invite = lan.getInvite()!.value;
  const app = createApp(token, session, lan, async () => {});
  const res = await app.request("/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: invite }),
  });
  expect(res.status).toBe(200);
  expect(lan.getInvite()!.used).toBe(true);
});

it("GET /api/settings/lan requires session", async () => {
  const app = createApp(createToken(), createSession(), new LanManager(3000), async () => {});
  const res = await app.request("/api/settings/lan");
  expect(res.status).toBe(401);
});
```

- [ ] **Step 5: Run tests**

```bash
npm test -- server/app.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add server/app.ts server/app.test.ts
git commit -m "feat: invite auth and LAN settings API routes"
```

---

## Task 7: Server rebind + localhost default

**Files:**
- Modify: `server/index.ts`
- Modify: `cli/index.ts`

- [ ] **Step 1: Refactor `startServer` to support rebind**

Extract server lifecycle into functions that `LanManager` + `index.ts` share:

```ts
let currentServer: ReturnType<typeof serve> | null = null;
let wss: WebSocketServer | null = null;

async function startListening(
  lan: LanManager,
  tls: TLSCredentials,
  port: number,
  app: Hono,
  session: Session,
): Promise<void> {
  // close existing if currentServer
  // serve with hostname: lan.getHostname()
  // attach WS upgrade handler (same as today)
}

async function onLanToggle(
  enabled: boolean,
  lan: LanManager,
  port: number,
  /* deps */
): Promise<void> {
  if (enabled) {
    const ip = getLanIP();
    if (ip === "127.0.0.1") throw new Error("No LAN IP");
    lan.enable(ip);
    const tls = await ensureTLS(...lan.getTlsHosts());
    await startListening(lan, tls, port, app, session);
  } else {
    lan.disable();
    const tls = await ensureTLS("localhost");
    await startListening(lan, tls, port, app, session);
  }
}
```

- [ ] **Step 2: Default bind `127.0.0.1`**

Change `hostname: "0.0.0.0"` → `lan.getHostname()` (starts as `127.0.0.1`).

- [ ] **Step 3: Update console output**

```ts
console.log(`  Open: https://localhost:${port}/\n`);
// Remove LAN IP from startup logs
```

- [ ] **Step 4: Update `cli/index.ts`**

```ts
const tls = await ensureTLS("localhost");
// Remove "Detected LAN IP" log or keep as info only, not URL
startServer(tls, PORT);
```

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

- [ ] **Step 6: Commit**

```bash
git add server/index.ts cli/index.ts
git commit -m "feat: localhost-first bind with LAN rebind support"
```

---

## Task 8: shadcn components

**Files:**
- Create: `src/components/ui/switch/*`, `label/*`, `alert-dialog/*`, `separator/*` (via CLI)

- [ ] **Step 1: Add components**

```bash
cd /Users/blaisetiong/Developer/v2
npx shadcn-vue@latest add switch label alert-dialog separator
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui
git commit -m "chore: add shadcn switch, label, alert-dialog, separator"
```

---

## Task 9: vue-router

**Files:**
- Create: `src/router/index.ts`
- Create: `src/views/LoginView.vue`
- Create: `src/views/TerminalView.vue`
- Create: `src/views/SettingsView.vue`
- Modify: `src/main.ts`
- Modify: `src/App.vue`

- [ ] **Step 1: Create router**

`src/router/index.ts`:

```ts
import { createRouter, createWebHistory } from "vue-router";
import LoginView from "@/views/LoginView.vue";
import TerminalView from "@/views/TerminalView.vue";
import SettingsView from "@/views/SettingsView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", name: "login", component: LoginView, meta: { public: true } },
    { path: "/", name: "terminal", component: TerminalView },
    { path: "/settings", name: "settings", component: SettingsView },
  ],
});

router.beforeEach(async (to) => {
  if (to.meta.public) return true;
  const res = await fetch("/api/settings/lan", { credentials: "include" });
  if (res.status === 401) {
    return { name: "login", query: to.query };
  }
  return true;
});

export default router;
```

- [ ] **Step 2: Wire `main.ts`**

```ts
import router from "./router";

const app = createApp(App);
app.use(router);
app.mount("#app");
```

- [ ] **Step 3: Simplify `App.vue`**

```vue
<template>
  <RouterView />
</template>
```

- [ ] **Step 4: Create views**

`LoginView.vue` — render `<Login />`, on success `router.push({ name: "terminal" })`.

`TerminalView.vue` — header with `RouterLink` to `/settings`, render `<Terminal />`.

`SettingsView.vue` — render `<Settings />`, back link to `/`.

- [ ] **Step 5: Commit**

```bash
git add src/router src/views src/main.ts src/App.vue
git commit -m "feat: add vue-router with auth guard"
```

---

## Task 10: Login invite auto-auth

**Files:**
- Modify: `src/components/Login.vue`
- Modify: `src/views/LoginView.vue`

- [ ] **Step 1: Read `invite` from route query**

In `LoginView.vue` (or Login.vue with `useRoute`):

```ts
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

onMounted(async () => {
  const invite = route.query.invite;
  if (typeof invite !== "string" || !invite) return;
  loading.value = true;
  const res = await fetch("/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token: invite }),
  });
  if (res.ok) {
    router.replace({ name: "terminal" });
    return;
  }
  const body = await res.json().catch(() => ({}));
  error.value = body.error ?? "Invalid invite link.";
  loading.value = false;
});
```

- [ ] **Step 2: Manual test**

1. Start server, enable LAN in settings (after Task 11), copy invite URL.
2. Open invite URL in private window → should land on terminal without manual token entry.

- [ ] **Step 3: Commit**

```bash
git add src/components/Login.vue src/views/LoginView.vue
git commit -m "feat: auto-authenticate from invite query param"
```

---

## Task 11: Settings + LanShareCard UI

**Files:**
- Create: `src/components/Settings.vue`
- Create: `src/components/LanShareCard.vue`
- Modify: `src/views/SettingsView.vue`

- [ ] **Step 1: Implement `Settings.vue`**

- `Switch` bound to `enabled` from `GET /api/settings/lan` on mount.
- Enable: `AlertDialog` confirm → `POST /api/settings/lan` `{ enabled: true }`.
- Disable: `AlertDialog` “Stop LAN access?” → `POST` `{ enabled: false }`.
- Show `LanShareCard` when `enabled`.
- On rebind, show toast “Reconnecting…” — Terminal WS may drop; user refreshes or WS reconnect logic in Task 12.

- [ ] **Step 2: Implement `LanShareCard.vue`**

```ts
import QRCode from "qrcode";

// props: lanUrl, inviteExpiresAt
// canvas ref → QRCode.toCanvas(canvas, lanUrl)
// Copy button → navigator.clipboard.writeText(lanUrl)
// Regenerate → POST /api/settings/lan/refresh-invite
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Settings.vue src/components/LanShareCard.vue src/views/SettingsView.vue
git commit -m "feat: settings page with LAN toggle and QR share card"
```

---

## Task 12: Terminal header + Vite proxy

**Files:**
- Modify: `src/components/Terminal.vue`
- Modify: `src/views/TerminalView.vue`
- Modify: `vite.config.ts`

- [ ] **Step 1: Add header in `TerminalView.vue`**

```vue
<header class="flex items-center justify-between px-3 py-2 border-b">
  <span class="text-sm text-muted-foreground">lan-terminal</span>
  <RouterLink to="/settings" class="text-sm hover:underline">Settings</RouterLink>
</header>
<Terminal class="flex-1" />
```

- [ ] **Step 2: Proxy `/api` in vite**

```ts
"/api": {
  target: "https://localhost:3001",
  secure: false,
  changeOrigin: true,
},
```

- [ ] **Step 3: Run dev smoke test**

```bash
npm run dev
```

Open `http://localhost:5173` → login → terminal → settings → toggle LAN.

- [ ] **Step 4: Commit**

```bash
git add src/views/TerminalView.vue vite.config.ts
git commit -m "feat: terminal settings link and /api dev proxy"
```

---

## Task 13: Update design spec + final verification

**Files:**
- Modify: `docs/superpowers/specs/2026-05-23-lan-localhost-default-design.md`

- [ ] **Step 1: Update spec navigation section**

Replace view-state bullets with vue-router routes (`/login`, `/`, `/settings`).

- [ ] **Step 2: Run full verification**

```bash
npm test
npm run build
npm start
```

Checklist:
- [ ] Startup shows token + `https://localhost:3000/` only
- [ ] `curl -k https://127.0.0.1:3000/` works; LAN IP unreachable before enable
- [ ] Settings enable shows QR URL with `?invite=`
- [ ] Invite URL works once; second attempt shows error
- [ ] Disable LAN returns to localhost-only bind

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-05-23-lan-localhost-default-design.md
git commit -m "docs: update spec to reflect vue-router navigation"
```

---

## Plan Self-Review

| Spec requirement | Task |
|------------------|------|
| Localhost default bind | Task 7 |
| Settings UI + shadcn | Tasks 8, 11 |
| LAN rebind | Task 7 |
| Invite single-use 15min | Task 2, 6 |
| QR with invite URL | Task 11 |
| Startup token unchanged | Task 6 (startup path preserved) |
| vue-router navigation | Task 9 (user request) |
| GET/POST settings API | Task 6 |
| refresh-invite | Task 6 |
| No LAN on CLI startup | Task 7 |

**Deviation documented:** Spec said `App.vue` view state; plan uses vue-router per user request.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-23-lan-localhost-default.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement tasks in this session with checkpoints  

Which approach do you want?
