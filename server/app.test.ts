import { describe, it, expect, vi } from "vitest";
import { createApp } from "./app.js";
import { createToken } from "./modules/auth/token.js";
import { createSession, activateSession } from "./modules/auth/session.js";
import { LanManager } from "./modules/settings/lan.js";

function makeApp() {
  const token = createToken();
  const session = createSession();
  const lan = new LanManager(3000);
  const app = createApp(token, session, lan, async () => {});
  return { token, session, lan, app };
}

describe("POST /auth", () => {
  it("returns 401 for wrong token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { app } = makeApp();
    const res = await app.request("/api/auth", {
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
    const { token, app } = makeApp();
    vi.setSystemTime(3_600_001);
    const res = await app.request("/api/auth", {
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
    const { token, session, app } = makeApp();
    session.active = true;
    const res = await app.request("/api/auth", {
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
    const { token, session, app } = makeApp();
    const res = await app.request("/api/auth", {
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

  it("authenticates with valid invite token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { session, lan, app } = makeApp();
    lan.enable("192.168.1.10");
    const invite = lan.getInvite()!.value;
    const res = await app.request("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: invite }),
    });
    expect(res.status).toBe(200);
    expect(lan.getInvite()!.used).toBe(true);
    expect(session.active).toBe(true);
    vi.useRealTimers();
  });
});

describe("GET /api/settings/lan", () => {
  it("requires session", async () => {
    const { app } = makeApp();
    const res = await app.request("/api/settings/lan");
    expect(res.status).toBe(401);
  });

  it("returns lan state when authenticated", async () => {
    const { session, lan, app } = makeApp();
    activateSession(session);
    lan.enable("192.168.1.10");
    const res = await app.request("/api/settings/lan", {
      headers: { cookie: `sid=${session.sid}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(true);
    expect(body.lanUrl).toMatch(/\?invite=/);
  });
});
