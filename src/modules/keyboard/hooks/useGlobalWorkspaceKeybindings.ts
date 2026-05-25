import { useEventListener } from "@vueuse/core";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import { useRouter } from "vue-router";
import {
  consumeWorkspaceKeyEvent,
  matchWorkspaceKeyAction,
} from "../lib/workspace-key-event";
import { useKeybindingsQuery } from "../queries/keybindings";
import { KEYBINDING_OPTIONS } from "../options";
import { useWorktreePanels } from "@/modules/workspace/lib/worktree-panels-storage";
import {
  useCreateTerminalMutation,
  useTerminalsQuery,
} from "@/modules/terminal/queries";

/** Workspace shortcuts take priority over terminal and file preview, app-wide in the worktree shell. */
export function useGlobalWorkspaceKeybindings(worktreeId: MaybeRefOrGetter<string | undefined>) {
  const router = useRouter();
  const resolvedWorktreeId = computed(() => toValue(worktreeId) ?? "");
  const { data: bindings } = useKeybindingsQuery();
  const panelsState = useWorktreePanels(resolvedWorktreeId);
  const { data: terminals } = useTerminalsQuery(resolvedWorktreeId);
  const createTerminal = useCreateTerminalMutation(resolvedWorktreeId);

  const terminalTabItems = computed(() =>
    (terminals.value ?? []).map((t) => ({ id: t.id })),
  );

  useEventListener(
    window,
    "keydown",
    (event: KeyboardEvent) => {
      const wtId = resolvedWorktreeId.value;
      if (!wtId) return;

      const map = bindings.value ?? KEYBINDING_OPTIONS;
      const matched = matchWorkspaceKeyAction(event, map);
      if (!matched) return;

      consumeWorkspaceKeyEvent(event);

      if (matched === "terminal.newTerminal") {
        void createTerminal.mutateAsync(undefined).then((terminal) => {
          router.push({
            name: "terminal",
            params: { worktreeId: wtId, terminalId: terminal.id },
          });
        });
        return;
      }
      if (matched === "panel.explorer") {
        panelsState.value = { ...panelsState.value, explorer: true };
        router.push({ name: "explorer", params: { worktreeId: wtId } });
        return;
      }
      if (matched === "panel.git") {
        panelsState.value = { ...panelsState.value, git: true };
        router.push({ name: "git", params: { worktreeId: wtId } });
        return;
      }
      const tabMatch = matched.match(/^terminal\.tab\.(\d)$/);
      if (tabMatch) {
        const index = parseInt(tabMatch[1], 10) - 1;
        const tab = terminalTabItems.value[index];
        if (tab) {
          router.push({
            name: "terminal",
            params: { worktreeId: wtId, terminalId: tab.id },
          });
        }
      }
    },
    { capture: true },
  );
}
