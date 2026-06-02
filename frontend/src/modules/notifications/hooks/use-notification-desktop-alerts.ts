import { useEventListener } from "@vueuse/core";
import { ref, watch } from "vue";
import { showDesktopNotification } from "@/modules/notifications/lib/desktop-notify";
import {
  useNotifications,
  type NotificationsStore,
} from "@/modules/notifications/hooks/use-notifications";

/** Show OS notifications when new unread items arrive from polling (agents, hooks, etc.). */
export function useNotificationDesktopAlerts(store?: NotificationsStore) {
  const { notifications, panelOpen } = store ?? useNotifications();
  const seenIds = ref(new Set<string>());
  const initialized = ref(false);

  watch(
    notifications,
    (list) => {
      const ids = new Set(list.map((n) => n.id));
      if (!initialized.value) {
        seenIds.value = ids;
        initialized.value = true;
        return;
      }
      for (const n of list) {
        if (n.read || seenIds.value.has(n.id)) continue;
        seenIds.value.add(n.id);
        if (panelOpen.value) continue;
        showDesktopNotification(n.title, {
          body: n.subtitle ? `${n.subtitle}\n${n.body}` : n.body,
          tag: `workbench-${n.id}`,
        });
      }
      seenIds.value = ids;
    },
    { deep: true },
  );

  useEventListener(window, "keydown", (event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || !event.shiftKey) return;
    if (event.key.toLowerCase() !== "i") return;
    event.preventDefault();
    panelOpen.value = !panelOpen.value;
  });
}
