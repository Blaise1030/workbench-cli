import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  LAN_REQUIRES_TLS_MESSAGE,
  resolveTransport,
  formatOrigin,
} from "./transport.js";

vi.mock("./tls.js", () => ({
  ensureTLS: vi.fn(),
}));

import { ensureTLS } from "./tls.js";

const mockedEnsureTLS = vi.mocked(ensureTLS);

describe("resolveTransport", () => {
  beforeEach(() => {
    mockedEnsureTLS.mockReset();
  });

  it("returns HTTPS when mkcert succeeds", async () => {
    mockedEnsureTLS.mockResolvedValue({ key: Buffer.from("k"), cert: Buffer.from("c") });
    const transport = await resolveTransport({ hosts: ["localhost"] });
    expect(transport.scheme).toBe("https");
    expect(transport.tls).not.toBeNull();
  });

  it("forwards confirmMkcertInstall to ensureTLS", async () => {
    mockedEnsureTLS.mockResolvedValue({ key: Buffer.from("k"), cert: Buffer.from("c") });
    const confirmMkcertInstall = vi.fn().mockResolvedValue(true);
    await resolveTransport({ hosts: ["localhost"], confirmMkcertInstall });
    expect(mockedEnsureTLS).toHaveBeenCalledWith(
      ["localhost"],
      expect.objectContaining({ confirmInstall: confirmMkcertInstall }),
    );
  });

  it("falls back to HTTP on localhost when mkcert fails", async () => {
    mockedEnsureTLS.mockRejectedValue(new Error("mkcert not found"));
    const transport = await resolveTransport({ hosts: ["localhost"] });
    expect(transport.scheme).toBe("http");
    expect(transport.tls).toBeNull();
  });

  it("does not fall back to HTTP when TLS is required", async () => {
    mockedEnsureTLS.mockRejectedValue(new Error("mkcert not found"));
    await expect(
      resolveTransport({ hosts: ["localhost", "192.168.1.10"], requireTls: true }),
    ).rejects.toThrow(LAN_REQUIRES_TLS_MESSAGE);
  });

  it("forceHttp skips mkcert", async () => {
    const transport = await resolveTransport({ hosts: ["localhost"], forceHttp: true });
    expect(transport.scheme).toBe("http");
    expect(mockedEnsureTLS).not.toHaveBeenCalled();
  });

  it("rejects forceHttp with non-localhost hosts", async () => {
    await expect(
      resolveTransport({ hosts: ["192.168.1.10"], forceHttp: true }),
    ).rejects.toThrow(/localhost/i);
  });
});

describe("formatOrigin", () => {
  it("formats http and https origins", () => {
    expect(formatOrigin("http", "localhost", 3000)).toBe("http://localhost:3000/");
    expect(formatOrigin("https", "localhost", 3000)).toBe("https://localhost:3000/");
  });
});
