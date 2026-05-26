import type { InjectionKey, Ref } from "vue";

/** Mutable git diff item ids; GitPanel writes, workspace keybinding reads. */
export const contextQueueGitItemIdsKey: InjectionKey<Ref<string[]>> = Symbol(
  "context-queue-git-item-ids",
);
