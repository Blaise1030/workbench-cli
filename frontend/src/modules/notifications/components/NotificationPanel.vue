<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { XIcon } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useNotifications } from "@/modules/notifications/hooks/use-notifications";
import {
  useDeleteNotificationMutation,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from "@/modules/notifications/queries/notifications";
import { worktreePath } from "@/modules/workspace/lib/worktree-env";

const { notifications, panelOpen } = useNotifications();
const router = useRouter();
const markRead = useMarkNotificationReadMutation();
const markAllRead = useMarkAllNotificationsReadMutation();
const remove = useDeleteNotificationMutation();

const sorted = computed(() =>
  [...notifications.value].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  ),
);

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

async function openNotification(
  id: string,
  worktreeId: string | null,
  terminalId: string | null,
) {
  await markRead.mutateAsync(id);
  if (!worktreeId) return;
  panelOpen.value = false;
  if (terminalId) {
    await router.push({
      name: "terminal",
      params: { worktreeId, terminalId },
    });
    return;
  }
  await router.push(worktreePath(worktreeId));
}
</script>

<template>
  <Sheet v-model:open="panelOpen">
    <SheetContent side="right" class="flex w-full flex-col sm:max-w-md">
      <SheetHeader class="shrink-0 border-b pb-4">
        <SheetTitle>Notifications</SheetTitle>
        <SheetDescription>
          Agent completions and hook alerts. Shortcut: ⌘⇧I
        </SheetDescription>
        <div class="flex gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            :disabled="sorted.length === 0 || markAllRead.isPending.value"
            @click="markAllRead.mutate()"
          >
            Mark all read
          </Button>
        </div>
      </SheetHeader>

      <div class="min-h-0 flex-1 overflow-y-auto py-2">
        <p
          v-if="sorted.length === 0"
          class="px-4 py-8 text-center text-sm text-muted-foreground"
        >
          No notifications yet. When an agent finishes in a terminal tab, you will see it here.
        </p>

        <ul v-else class="divide-y">
          <li
            v-for="n in sorted"
            :key="n.id"
            class="group relative px-4 py-3 hover:bg-muted/50"
            :class="!n.read && 'bg-muted/30'"
          >
            <button
              type="button"
              class="w-full text-left"
              @click="openNotification(n.id, n.worktreeId, n.terminalId)"
            >
              <div class="flex items-start justify-between gap-2 pr-8">
                <p class="text-sm font-medium leading-snug">{{ n.title }}</p>
                <span class="shrink-0 text-xs text-muted-foreground">
                  {{ relativeTime(n.createdAt) }}
                </span>
              </div>
              <p v-if="n.subtitle" class="mt-0.5 text-xs text-muted-foreground">
                {{ n.subtitle }}
              </p>
              <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{{ n.body }}</p>
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="absolute right-2 top-2 size-7 opacity-0 group-hover:opacity-100"
              aria-label="Dismiss"
              @click.stop="remove.mutate(n.id)"
            >
              <XIcon class="size-3.5" />
            </Button>
          </li>
        </ul>
      </div>
    </SheetContent>
  </Sheet>
</template>
