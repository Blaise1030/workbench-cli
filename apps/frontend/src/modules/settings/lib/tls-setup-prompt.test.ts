import { describe, expect, it } from "vitest";
import { buildTlsSetupPrompt, tlsCertPaths } from "./tls-setup-prompt";

describe("tlsCertPaths", () => {
  it("uses the configured hostname and standard TLS host list", () => {
    const paths = tlsCertPaths("workbench.local");
    expect(paths.certFile).toBe("~/.workbench/certs/127.0.0.1.pem");
    expect(paths.keyFile).toBe("~/.workbench/certs/127.0.0.1-key.pem");
    expect(paths.mkcertHosts).toEqual(["workbench.local", "localhost", "127.0.0.1"]);
  });

  it("trims surrounding whitespace from the host", () => {
    const paths = tlsCertPaths("  dev.box  ");
    expect(paths.mkcertHosts[0]).toBe("dev.box");
  });
});

describe("buildTlsSetupPrompt", () => {
  it("includes mkcert steps and the PEM file paths", () => {
    const prompt = buildTlsSetupPrompt("workbench.local");
    expect(prompt).toContain("mkcert");
    expect(prompt).toContain("mkcert -install");
    expect(prompt).toContain("~/.workbench/certs/127.0.0.1.pem");
    expect(prompt).toContain("~/.workbench/certs/127.0.0.1-key.pem");
    expect(prompt).toContain("workbench.local localhost 127.0.0.1");
    expect(prompt).toContain("without `--http`");
  });

  it("uses a custom hostname when changed", () => {
    const prompt = buildTlsSetupPrompt("dev.box");
    expect(prompt).toContain("dev.box localhost 127.0.0.1");
    expect(prompt).not.toContain("workbench.local");
  });
});
