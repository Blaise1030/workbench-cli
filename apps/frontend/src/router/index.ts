import { createRouter, createWebHistory } from "vue-router";
import { defineAsyncComponent } from "vue";
import { PanelLoading } from "@/components/ui/panel-loading";
import { ensureLocalAuth } from "@/api/auth";
import { networkSettingsQueryOptions } from "@/modules/settings/queries/settings";
import { queryClient } from "@/lib/query-client";
import { rememberSettingsReturnRoute } from "@/modules/settings/lib/settings-return-route";

function lazy(loader: () => Promise<{ default: object }>) {
  return defineAsyncComponent({ loader, loadingComponent: PanelLoading, delay: 0 });
}

const WorkspaceView = lazy(() => import("@/modules/workspace/pages/WorkspaceView.vue"));
const SettingsView = lazy(() => import("@/modules/settings/layout/SettingsView.vue"));
const AgentsSettings = lazy(() => import("@/modules/settings/pages/AgentsSettings.vue"));
const NetworkSettings = lazy(() => import("@/modules/settings/pages/NetworkSettings.vue"));
const KeybindingsSettings = lazy(() => import("@/modules/settings/pages/KeybindingsSettings.vue"));
const AppearanceSettings = lazy(() => import("@/modules/settings/pages/AppearanceSettings.vue"));
const AboutSettings = lazy(() => import("@/modules/settings/pages/AboutSettings.vue"));
const Terminal = lazy(() => import("@/modules/terminal/pages/Terminal.vue"));
const GitPanel = lazy(() => import("@/modules/git/pages/GitPanel.vue"));
const FileExplorerPanel = lazy(() => import("@/modules/file-explorer/pages/FileExplorerPanel.vue"));
const VALID_GIT_TABS = ["staged", "unstaged"] as const;

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: WorkspaceView,
    },
    {
      path: "/w/:worktreeId",
      name: "workspace",
      component: WorkspaceView,
      children: [
        {
          path: "t/:terminalId",
          name: "terminal",
          component: Terminal,
          props: (route) => ({ sessionId: route.params.terminalId }),
        },
        {
          path: "git",
          name: "git",
          component: GitPanel,
          props: (route) => ({ worktreeId: route.params.worktreeId }),
          beforeEnter: (to) => {
            const tab = to.query.tab;
            if (tab === "untracked") {
              return { name: "git", params: to.params, query: { tab: "unstaged" } };
            }
            if (!VALID_GIT_TABS.includes(tab as typeof VALID_GIT_TABS[number])) {
              return { name: "git", params: to.params, query: { tab: "staged" } };
            }
          },
        },
        {
          path: "explorer",
          name: "explorer",
          component: FileExplorerPanel,
          props: (route) => ({ worktreeId: route.params.worktreeId }),
        },
      ],
    },
    {
      path: "/settings",
      name: "settings",
      component: SettingsView,
      redirect: { name: "settings-agents" },
      children: [
        { path: "agents", name: "settings-agents", component: AgentsSettings },
        { path: "network", name: "settings-network", component: NetworkSettings },
        { path: "keybindings", name: "settings-keybindings", component: KeybindingsSettings },
        { path: "appearance", name: "settings-appearance", component: AppearanceSettings },
        { path: "about", name: "settings-about", component: AboutSettings },
      ],
    },
  ],
});

router.beforeEach(async (to, from) => {
  if (to.path.startsWith("/settings") && !from.path.startsWith("/settings")) {
    rememberSettingsReturnRoute(from.fullPath);
  }

  const search = new URLSearchParams(window.location.search);
  const inviteToken = search.get("invite") || search.get("token") || undefined;

  try {
    await ensureLocalAuth(inviteToken);
    queryClient.prefetchQuery(networkSettingsQueryOptions());

    // Clean the token from the URL after successful validation (one-time use)
    if (inviteToken) {
      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  } catch {
    // Auth failed (e.g. API down, or dev UI origin not allowed on Go). Skip prefetch.
  }
  return true;
});

export default router;
