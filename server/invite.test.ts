import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createInvite, isInviteValid, consumeInvite } from "./invite.js";

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
