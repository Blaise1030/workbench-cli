import { showDesktopNotification } from "@/modules/notifications/lib/desktop-notify";

export function notifyCommandSuccess(tabLabel: string): void {
  showDesktopNotification("Command finished", {
    body: tabLabel,
    tag: "workbench-command",
    suppressWhenVisible: true,
  });
}
