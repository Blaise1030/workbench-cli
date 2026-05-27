import { describe, it, expect } from "vitest";
import * as tls from "./tls.js";

describe("parseCertPaths", () => {
  it("returns key and cert paths for given hosts", () => {
    const paths = tls.parseCertPaths("/cache", "localhost", "192.168.1.10");
    expect(paths.certFile).toBe("/cache/192.168.1.10.pem");
    expect(paths.keyFile).toBe("/cache/192.168.1.10-key.pem");
  });

  it("uses only localhost when no LAN IP", () => {
    const paths = tls.parseCertPaths("/cache", "localhost");
    expect(paths.certFile).toBe("/cache/localhost.pem");
    expect(paths.keyFile).toBe("/cache/localhost-key.pem");
  });
});

describe("buildCertArgs", () => {
  it("includes all hosts in mkcert args", () => {
    const args = tls.buildCertArgs("/cache", "localhost", "192.168.1.10");
    expect(args).toContain("localhost");
    expect(args).toContain("192.168.1.10");
    expect(args).toContain("-cert-file");
    expect(args).toContain("-key-file");
  });
});
