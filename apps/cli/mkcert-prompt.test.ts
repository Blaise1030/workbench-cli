import { describe, it, expect } from "vitest";
import { getMkcertInstallHint } from "./mkcert-prompt.js";

describe("getMkcertInstallHint", () => {
  it("returns a non-empty install hint", () => {
    const hint = getMkcertInstallHint();
    expect(hint.length).toBeGreaterThan(10);
  });
});
