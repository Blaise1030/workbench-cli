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

  it("matches cursor agent invocations", () => {
    expect(matchAgentAdapter("agent --resume chat-id")?.kind).toBe("cursor");
    expect(matchAgentAdapter("/Users/me/.local/bin/cursor-agent")?.kind).toBe("cursor");
  });

  it("matches gemini invocations", () => {
    expect(matchAgentAdapter("gemini --resume sess")?.kind).toBe("gemini");
  });

  it("builds resume argv", () => {
    expect(buildAgentResumeArgv("claude", "abc-123")).toEqual([
      "claude",
      "--resume",
      "abc-123",
    ]);
    expect(buildAgentResumeArgv("codex", "uuid")).toEqual(["codex", "resume", "uuid"]);
    expect(buildAgentResumeArgv("cursor", "chat-1")).toEqual([
      "agent",
      "--resume",
      "chat-1",
    ]);
    expect(buildAgentResumeArgv("gemini", "sess")).toEqual([
      "gemini",
      "--resume",
      "sess",
    ]);
  });
});
