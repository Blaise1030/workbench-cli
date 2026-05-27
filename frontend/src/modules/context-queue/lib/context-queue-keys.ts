import type { InjectionKey, Ref } from "vue";
import type { useContextQueue } from "@/modules/context-queue/hooks/use-context-queue";
import type { ContextQueueAnnotationsState } from "@/modules/context-queue/lib/context-queue-annotations-state";

export type ContextQueueApi = ReturnType<typeof useContextQueue>;

/** Context queue API from TerminalWorkspace (append, send, open). */
export const contextQueueKey: InjectionKey<ContextQueueApi> =
  Symbol("context-queue");

/** Mutable git diff item ids; GitPanel writes, workspace keybinding reads. */
export const contextQueueGitItemIdsKey: InjectionKey<Ref<string[]>> = Symbol(
  "context-queue-git-item-ids",
);

/** Shared inline comment annotations + view bridges (git / file preview). */
export const contextQueueAnnotationsKey: InjectionKey<ContextQueueAnnotationsState> =
  Symbol("context-queue-annotations");
