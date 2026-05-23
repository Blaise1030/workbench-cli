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
