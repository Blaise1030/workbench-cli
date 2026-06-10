import { describe, expect, it } from "vitest";
import { shouldAckAttention } from "./clear-attention";

describe("shouldAckAttention", () => {
  const base = {
    activeTerminalId: "t1",
    status: "needs_attention",
    visible: true,
    lastAckedId: null as string | null,
  };

  it("fires when needs_attention, visible, active, and not yet acked", () => {
    expect(shouldAckAttention(base)).toBe(true);
  });

  it("does not fire when there is no active terminal", () => {
    expect(shouldAckAttention({ ...base, activeTerminalId: null })).toBe(false);
  });

  it("does not fire when the page is not visible", () => {
    expect(shouldAckAttention({ ...base, visible: false })).toBe(false);
  });

  it("does not fire when status is not needs_attention", () => {
    expect(shouldAckAttention({ ...base, status: "running" })).toBe(false);
    expect(shouldAckAttention({ ...base, status: undefined })).toBe(false);
  });

  it("does not re-fire while already acked for this terminal", () => {
    expect(shouldAckAttention({ ...base, lastAckedId: "t1" })).toBe(false);
  });

  it("fires again for a different terminal even if another was acked", () => {
    expect(shouldAckAttention({ ...base, lastAckedId: "t2" })).toBe(true);
  });
});
