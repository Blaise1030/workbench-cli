import { describe, expect, it } from "vitest";
import { buildHostsSetupPrompt } from "./hosts-setup-prompt";

describe("buildHostsSetupPrompt", () => {
  it("includes the configured hostname and the hosts line", () => {
    const prompt = buildHostsSetupPrompt("workbench.local");
    expect(prompt).toContain("127.0.0.1 workbench.local");
    expect(prompt).toContain("/etc/hosts");
    expect(prompt).toContain("sudo");
  });

  it("uses a custom hostname when changed", () => {
    const prompt = buildHostsSetupPrompt("dev.box");
    expect(prompt).toContain("127.0.0.1 dev.box");
    expect(prompt).not.toContain("workbench.local");
  });

  it("trims surrounding whitespace from the host", () => {
    const prompt = buildHostsSetupPrompt("  dev.box  ");
    expect(prompt).toContain("127.0.0.1 dev.box");
  });
});
