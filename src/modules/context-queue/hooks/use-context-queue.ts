import { computed, ref, type MaybeRefOrGetter, toValue } from "vue";
import { toast } from "vue-sonner";
import { useTerminalSessions } from "@/modules/terminal/hooks/terminal-sessions";
import { useTerminalsQuery } from "@/modules/terminal/queries";
import { useWorktreePanels } from "@/modules/workspace/lib/worktree-panels-storage";
import { useContextQueueStorage } from "@/modules/context-queue/lib/context-queue-storage";
import { formatQueueAppend } from "@/modules/context-queue/lib/format-queue-append";

export function useContextQueue(worktreeId: MaybeRefOrGetter<string>) {
  const storage = useContextQueueStorage(worktreeId);
  const sessions = useTerminalSessions();
  const panelsState = useWorktreePanels(worktreeId);
  const { data: terminals } = useTerminalsQuery(worktreeId);
  const popoverOpen = ref(false);

  const text = computed({
    get: () => storage.value.text,
    set: (value: string) => {
      storage.value = { text: value };
    },
  });

  function resolveTerminalId(): string | null {
    const ids = (terminals.value ?? []).map((t) => t.id);
    if (!ids.length) return null;
    const active = sessions.activeId.value;
    if (active && ids.includes(active)) return active;
    const last = panelsState.value.lastTerminalId;
    if (last && ids.includes(last)) return last;
    return ids[0] ?? null;
  }

  function appendBlock(block: string) {
    const trimmed = block.trimEnd();
    if (!trimmed) return;
    const current = text.value.trimEnd();
    text.value = current ? `${current}\n\n${trimmed}\n\n` : `${trimmed}\n\n`;
  }

  function appendFromContext(ctx: {
    relativePath?: string;
    selection: string;
  }) {
    const selection = ctx.selection.trim();
    if (ctx.relativePath) {
      appendBlock(
        formatQueueAppend({
          relativePath: ctx.relativePath,
          selection: selection || undefined,
        }).trimEnd(),
      );
      return;
    }
    if (selection) {
      appendBlock(selection);
      toast.warning("Path unknown — appended selection only");
      return;
    }
    toast.error("Nothing to append");
  }

  function clear() {
    text.value = "";
  }

  const canSend = computed(
    () => Boolean(text.value.trim()) && Boolean(resolveTerminalId()),
  );

  function send(): boolean {
    const body = text.value.trim();
    if (!body) return false;
    const id = resolveTerminalId();
    if (!id) {
      toast.error("Open a terminal first");
      return false;
    }
    const payload = body.endsWith("\n") ? body : `${body}\n`;
    sessions.get(id)?.sendInput(payload);
    text.value = "";
    toast.success("Sent to terminal");
    return true;
  }

  function openPopover() {
    popoverOpen.value = true;
  }

  return {
    text,
    popoverOpen,
    appendFromContext,
    clear,
    send,
    openPopover,
    canSend,
  };
}
