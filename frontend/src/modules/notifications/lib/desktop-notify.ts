let permissionRequested = false;

/** Ask once on first app load so alerts work when the tab is in the background. */
export function ensureNotificationPermission(): void {
  if (typeof Notification === "undefined" || Notification.permission !== "default") {
    return;
  }
  if (permissionRequested) return;
  permissionRequested = true;
  void Notification.requestPermission();
}

export function showDesktopNotification(
  title: string,
  options?: { body?: string; tag?: string; suppressWhenVisible?: boolean },
): void {
  if (typeof Notification === "undefined") return;
  if (options?.suppressWhenVisible && typeof document !== "undefined" && !document.hidden) {
    return;
  }
  if (Notification.permission === "granted") {
    new Notification(title, {
      body: options?.body,
      tag: options?.tag ?? "workbench",
    });
    return;
  }
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
}
