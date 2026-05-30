import { createRouter, createWebHistory } from "vue-router";
import WorkspaceView from "@/modules/workspace/pages/WorkspaceView.vue";
import SettingsView from "@/modules/settings/layout/SettingsView.vue";
import GeneralSettings from "@/modules/settings/pages/GeneralSettings.vue";
import NetworkSettings from "@/modules/settings/pages/NetworkSettings.vue";
import KeybindingsSettings from "@/modules/settings/pages/KeybindingsSettings.vue";
import Terminal from "@/modules/terminal/pages/Terminal.vue";
import GitPanel from "@/modules/git/pages/GitPanel.vue";
import FileExplorerPanel from "@/modules/file-explorer/pages/FileExplorerPanel.vue";
import { ensureLocalAuth } from "@/api/auth";
import { networkSettingsQueryOptions } from "@/modules/settings/queries/settings";
import { queryClient } from "@/lib/query-client";
import { rememberSettingsReturnRoute } from "@/modules/settings/lib/settings-return-route";
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
      redirect: { name: "settings-general" },
      children: [
        { path: "general", name: "settings-general", component: GeneralSettings },
        { path: "network", name: "settings-network", component: NetworkSettings },
        { path: "keybindings", name: "settings-keybindings", component: KeybindingsSettings },
      ],
    },
  ],
});

router.beforeEach(async (to, from) => {
  if (to.path.startsWith("/settings") && !from.path.startsWith("/settings")) {
    rememberSettingsReturnRoute(from.fullPath);
  }

  try {
    await ensureLocalAuth();
    queryClient.prefetchQuery(networkSettingsQueryOptions());
  } catch {
    // Auth failed (e.g. API down, or dev UI origin not allowed on Go). Skip prefetch.
  }
  return true;
});

export default router;
