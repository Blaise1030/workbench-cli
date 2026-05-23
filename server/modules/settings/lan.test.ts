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
