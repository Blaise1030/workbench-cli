import type { WorkbenchAgent } from "@/modules/settings/types/agents";

export type AddTerminalChoice =
  | { kind: "shell" }
  | { kind: "agent"; agent: WorkbenchAgent };
