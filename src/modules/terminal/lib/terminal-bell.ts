export function notifyCommandSuccess(tabLabel: string): void {
  if (typeof document === "undefined" || !document.hidden) return;
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "granted") {
    new Notification("Command finished", { body: tabLabel, tag: "lan-terminal-command" });
    return;
  }
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
}
