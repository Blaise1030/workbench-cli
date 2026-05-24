import { describe, it, expect } from "vitest";
import { extractInvocation, matchAgentAdapter } from "./match.js";
import { buildAgentResumeArgv } from "./match.js";

describe("matchAgentAdapter", () => {
  it("matches claude invocations", () => {
    expect(extractInvocation("claude --resume foo")).toBe("claude");
    expect(matchAgentAdapter("env FOO=1 claude")?.kind).toBe("claude");
  });

  it("matches codex invocations", () => {
    expect(matchAgentAdapter("/usr/local/bin/codex resume")?.kind).toBe("codex");
  });

  it("builds resume argv", () => {
    expect(buildAgentResumeArgv("claude", "abc-123")).toEqual([
      "claude",
      "--resume",
      "abc-123",
    ]);
    expect(buildAgentResumeArgv("codex", "uuid")).toEqual(["codex", "resume", "uuid"]);
  });
});
