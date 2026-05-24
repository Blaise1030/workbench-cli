import { describe, it, expect } from "vitest";
import { sanitizeEnv } from "./sanitize-env.js";

describe("sanitizeEnv", () => {
  it("removes sensitive keys", () => {
    const out = sanitizeEnv({
      PATH: "/usr/bin",
      API_TOKEN: "secret",
      MY_PASSWORD: "x",
      SAFE: "ok",
    });
    expect(out).toEqual({ PATH: "/usr/bin", SAFE: "ok" });
  });
});
