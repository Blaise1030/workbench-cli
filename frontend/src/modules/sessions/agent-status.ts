const STATUS_LABELS: Record<string, string> = {
  running: "Running",
  thinking: "Thinking",
  waiting: "Waiting",
  done: "Done",
  idle: "Idle",
  stop: "Stop",
};

export function formatAgentStatus(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (!normalized) return "";
  if (STATUS_LABELS[normalized]) return STATUS_LABELS[normalized];
  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function agentStatusClass(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === "running" || normalized === "thinking") return "text-green-500";
  if (normalized === "waiting") return "text-orange-500";
  return "text-muted-foreground";
}
