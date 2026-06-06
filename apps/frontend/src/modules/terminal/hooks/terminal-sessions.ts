import { inject, ref, type InjectionKey, type Ref } from "vue";
import {
  TerminalSession,
  type TerminalSessionMeta,
} from "@/modules/terminal/lib/terminal-session";

export type { TerminalSessionMeta };

export interface TerminalSessionsStore {
  create(meta: TerminalSessionMeta): TerminalSession;
  get(id: string): TerminalSession | undefined;
  remove(id: string): void;
  attach(id: string, terminal: Parameters<TerminalSession["attach"]>[0]): void;
  detach(id: string): void;
  tabLabel(id: string): string;
  tabCwd(id: string): string | null;
  activeId: Ref<string | null>;
}

export function createTerminalSessionsStore(): TerminalSessionsStore {
  const sessions = new Map<string, TerminalSession>();
  const tabLabels = ref<Record<string, string>>({});
  const tabCwds = ref<Record<string, string | null>>({});
  const activeId = ref<string | null>(null);

  function syncMeta(id: string, session: TerminalSession) {
    tabLabels.value = { ...tabLabels.value, [id]: session.tabLabel };
    tabCwds.value = { ...tabCwds.value, [id]: session.cwd };
  }

  function create(meta: TerminalSessionMeta) {
    const session = new TerminalSession(meta);
    session.setOnLabelChange(() => syncMeta(meta.id, session));
    session.setShouldNotifySuccess(() => {
      const isActiveTab = activeId.value === meta.id;
      const pageVisible =
        typeof document !== "undefined" && document.visibilityState === "visible";
      return !isActiveTab || !pageVisible;
    });
    sessions.set(meta.id, session);
    return session;
  }

  function get(id: string) {
    return sessions.get(id);
  }

  function remove(id: string) {
    sessions.get(id)?.dispose();
    sessions.delete(id);
    const { [id]: _l, ...restLabels } = tabLabels.value;
    const { [id]: _c, ...restCwds } = tabCwds.value;
    tabLabels.value = restLabels;
    tabCwds.value = restCwds;
    if (activeId.value === id) activeId.value = null;
  }

  function attach(id: string, terminal: Parameters<TerminalSession["attach"]>[0]) {
    const switchingTab = activeId.value !== null && activeId.value !== id;
    for (const [sid, session] of sessions) {
      if (sid !== id) session.detach();
    }
    activeId.value = id;
    sessions.get(id)?.attach(terminal, { reset: switchingTab });
  }

  function detach(id: string) {
    sessions.get(id)?.detach();
    if (activeId.value === id) activeId.value = null;
  }

  function tabLabel(id: string) {
    return tabLabels.value[id] ?? sessions.get(id)?.tabLabel ?? "Terminal";
  }

  function tabCwd(id: string) {
    return tabCwds.value[id] ?? sessions.get(id)?.cwd ?? null;
  }

  return { create, get, remove, attach, detach, tabLabel, tabCwd, activeId };
}

export const terminalSessionsKey: InjectionKey<TerminalSessionsStore> =
  Symbol("terminal-sessions");

export function useTerminalSessions() {
  const store = inject(terminalSessionsKey);
  if (!store) {
    throw new Error("useTerminalSessions() requires TerminalWorkspace provider");
  }
  return store;
}
