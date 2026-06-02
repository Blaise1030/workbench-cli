import { computed, inject, provide, ref, type ComputedRef, type InjectionKey, type Ref } from "vue";
import { useNotificationsQuery, useSendNotificationMutation } from "@/modules/notifications/queries/notifications";
import type { Notification } from "@/modules/notifications/types";

export interface NotificationsStore {
  notifications: ComputedRef<Notification[]>;
  unreadCount: ComputedRef<number>;
  unreadByWorktree: ComputedRef<Record<string, number>>;
  panelOpen: Ref<boolean>;
  push: (
    worktreeId: string | null,
    title: string,
    body: string,
    subtitle?: string | null,
  ) => Promise<void>;
}

export const notificationsKey: InjectionKey<NotificationsStore> = Symbol("notifications");

export function createNotificationsStore(): NotificationsStore {
  const panelOpen = ref(false);
  const { data } = useNotificationsQuery();
  const send = useSendNotificationMutation();

  const notifications = computed(() => data.value ?? []);

  const unreadCount = computed(
    () => notifications.value.filter((n) => !n.read).length,
  );

  const unreadByWorktree = computed(() => {
    const counts: Record<string, number> = {};
    for (const n of notifications.value) {
      if (n.read || !n.worktreeId) continue;
      counts[n.worktreeId] = (counts[n.worktreeId] ?? 0) + 1;
    }
    return counts;
  });

  async function push(
    worktreeId: string | null,
    title: string,
    body: string,
    subtitle?: string | null,
  ) {
    await send.mutateAsync({
      worktreeId,
      title,
      body,
      subtitle: subtitle ?? null,
    });
  }

  return {
    notifications,
    unreadCount,
    unreadByWorktree,
    panelOpen,
    push,
  };
}

export function provideNotificationsStore() {
  const store = createNotificationsStore();
  provide(notificationsKey, store);
  return store;
}

export function useNotifications() {
  const store = inject(notificationsKey);
  if (!store) {
    throw new Error("useNotifications() requires provideNotificationsStore() in App.vue");
  }
  return store;
}
