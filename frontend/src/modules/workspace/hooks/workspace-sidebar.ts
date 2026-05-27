import { inject, ref, type InjectionKey, type Ref } from "vue";

export interface WorkspaceSidebarPanelApi {
  collapse: () => void;
  expand: () => void;
}

export interface WorkspaceSidebarStore {
  isCollapsed: Ref<boolean>;
  toggle: () => void;
  bindPanel: (api: WorkspaceSidebarPanelApi) => void;
}

export const workspaceSidebarKey: InjectionKey<WorkspaceSidebarStore> =
  Symbol("workspace-sidebar");

export function useWorkspaceSidebar() {
  const store = inject(workspaceSidebarKey);
  if (!store) {
    throw new Error(
      "useWorkspaceSidebar() requires WorkspaceLayout provider",
    );
  }
  return store;
}

export function createWorkspaceSidebarStore(): WorkspaceSidebarStore {
  const isCollapsed = ref(false);
  let panelApi: WorkspaceSidebarPanelApi | null = null;

  function bindPanel(api: WorkspaceSidebarPanelApi) {
    panelApi = api;
  }

  function toggle() {
    if (!panelApi) return;
    if (isCollapsed.value) {
      panelApi.expand();
    } else {
      panelApi.collapse();
    }
  }

  return { isCollapsed, toggle, bindPanel };
}
