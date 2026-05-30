/**
 * @pierre/diffs reads `navigator.userAgent` when CodeView loads. Node 20 (CI) has no
 * navigator; Node 22+ exposes a minimal one. Polyfill only when missing.
 */
if (globalThis.navigator == null) {
  Object.defineProperty(globalThis, "navigator", {
    value: { userAgent: "vitest" },
    writable: true,
    configurable: true,
  });
}
