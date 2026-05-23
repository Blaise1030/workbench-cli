import { describe, it, expect, vi } from "vitest";
import { parseCertPaths, isMkcertInstalled, buildCertArgs } from "./tls.js";

describe("parseCertPaths", () => {
  it("returns key and cert paths for given hosts", () => {
    const paths = parseCertPaths("/cache", "localhost", "192.168.1.10");
    expect(paths.certFile).toBe("/cache/192.168.1.10.pem");
    expect(paths.keyFile).toBe("/cache/192.168.1.10-key.pem");
  });

  it("uses only localhost when no LAN IP", () => {
    const paths = parseCertPaths("/cache", "localhost");
    expect(paths.certFile).toBe("/cache/localhost.pem");
    expect(paths.keyFile).toBe("/cache/localhost-key.pem");
  });
});

describe("buildCertArgs", () => {
  it("includes all hosts in mkcert args", () => {
    const args = buildCertArgs("/cache", "localhost", "192.168.1.10");
    expect(args).toContain("localhost");
    expect(args).toContain("192.168.1.10");
    expect(args).toContain("-cert-file");
    expect(args).toContain("-key-file");
  });
});
