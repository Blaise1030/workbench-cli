import { describe, expect, it } from "vitest";
import {
  bashIntegrationRcPath,
  integrationDir,
  shellIntegrationSpawn,
} from "./shell-integration.js";

describe("shellIntegrationSpawn", () => {
  it("sets ZDOTDIR for zsh", () => {
    const { env, args } = shellIntegrationSpawn("/bin/zsh", {
      HOME: "/Users/me",
    });
    expect(env.ZDOTDIR).toBe(integrationDir());
    expect(env.USER_ZDOTDIR).toBe("/Users/me");
    expect(env.LAN_TERMINAL).toBe("1");
    expect(args).toEqual(["-l"]);
  });

  it("uses --rcfile for bash", () => {
    const { env, args } = shellIntegrationSpawn("/bin/bash", {
      HOME: "/Users/me",
    });
    expect(env.LAN_TERMINAL).toBe("1");
    expect(args[0]).toBe("--rcfile");
    expect(args[1]).toBe(bashIntegrationRcPath());
  });

  it("leaves unknown shells unchanged", () => {
    const base = { HOME: "/Users/me" };
    const { env, args } = shellIntegrationSpawn("/bin/fish", base);
    expect(env).toEqual(base);
    expect(args).toEqual(["-l"]);
  });
});
