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
