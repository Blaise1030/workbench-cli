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
