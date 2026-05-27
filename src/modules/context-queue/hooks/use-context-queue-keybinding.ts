import { useEventListener } from "@vueuse/core";
import { type MaybeRefOrGetter, toValue } from "vue";
import { KEYBINDING_OPTIONS } from "@/modules/keyboard/options";
import {
  consumeWorkspaceKeyEvent,
  matchWorkspaceKeyAction,
} from "@/modules/keyboard/lib/workspace-key-event";
import { useKeybindingsQuery } from "@/modules/keyboard/queries/keybindings";
import {
  resolveExplorerContext,
  resolveGitContext,
} from "@/modules/context-queue/lib/resolve-code-context";
import type { useContextQueue } from "@/modules/context-queue/hooks/use-context-queue";
import type { ContextQueueAnnotationsState } from "@/modules/context-queue/lib/context-queue-annotations-state";

export function useContextQueueKeybinding(opts: {
  routeName: MaybeRefOrGetter<string | symbol | null | undefined>;
  worktreePath: MaybeRefOrGetter<string | undefined>;
  fileQuery: MaybeRefOrGetter<string | undefined>;
  gitItemIds: MaybeRefOrGetter<readonly string[]>;
  queue: ReturnType<typeof useContextQueue>;
  annotations: ContextQueueAnnotationsState | null;
}) {
  const { data: bindings } = useKeybindingsQuery();

  useEventListener(
    window,
    "keydown",
    (event: KeyboardEvent) => {
      const map = bindings.value ?? KEYBINDING_OPTIONS;
      if (matchWorkspaceKeyAction(event, map) !== "contextQueue.invoke") return;
      consumeWorkspaceKeyEvent(event);

      const name = toValue(opts.routeName);
      if (name === "terminal") {
        opts.queue.openPopover();
        return;
      }
      if (name === "git") {
        if (opts.annotations?.invokeGitBridge()) return;
        const root = document.querySelector<HTMLElement>(".git-diff-code-view");
        if (!root) return;
        const ctx = resolveGitContext({
          root,
          itemIds: toValue(opts.gitItemIds),
        });
        opts.queue.appendFromContext(ctx);
        return;
      }
      if (name === "explorer") {
        if (opts.annotations?.invokeExplorerBridge()) return;
        const root = document.querySelector<HTMLElement>(
          ".file-preview-code-view",
        );
        const wt = toValue(opts.worktreePath);
        if (!root || !wt) return;
        const ctx = resolveExplorerContext({
          root,
          worktreePath: wt,
          fileQueryEncoded: toValue(opts.fileQuery),
        });
        opts.queue.appendFromContext(ctx);
      }
    },
    { capture: true },
  );
}
