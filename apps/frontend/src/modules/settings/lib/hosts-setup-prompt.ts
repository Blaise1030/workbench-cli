/**
 * Builds an agent-ready prompt instructing an assistant to add the
 * workbench hosts entry idempotently. The host is interpolated so the
 * prompt stays in sync with the configured hostname.
 */
export function buildHostsSetupPrompt(host: string): string {
  const line = `127.0.0.1 ${host.trim()}`;
  return [
    "Add a hosts entry so my browser can resolve my local workbench hostname.",
    `Append the line \`${line}\` to \`/etc/hosts\`, but only if that exact`,
    "entry isn't already present (keep it idempotent). You'll need `sudo`.",
    "After adding it, confirm the entry exists by reading the file back.",
  ].join(" ");
}
