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
