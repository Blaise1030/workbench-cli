import { createRouter, createWebHistory } from "vue-router";
import LoginView from "@/modules/auth/pages/LoginView.vue";
import WorkspaceView from "@/modules/workspace/pages/WorkspaceView.vue";
import SettingsView from "@/modules/settings/layout/SettingsView.vue";
import GeneralSettings from "@/modules/settings/pages/GeneralSettings.vue";
import NetworkSettings from "@/modules/settings/pages/NetworkSettings.vue";
import Terminal from "@/modules/terminal/pages/Terminal.vue";
import GitPanel from "@/modules/git/pages/GitPanel.vue";
import FileExplorerPanel from "@/modules/file-explorer/pages/FileExplorerPanel.vue";
import { ensureLocalAuth } from "@/api/auth";
import { lanSettingsQueryOptions } from "@/modules/settings/queries/settings";
import { queryClient } from "@/lib/query-client";
import { ApiError, ensureOk } from "@/lib/api-error";
import { isLocalHost } from "@/lib/is-local-host";
const VALID_GIT_TABS = ["staged", "unstaged", "untracked"] as const;

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      name: "login",
      component: LoginView,
      meta: { public: true },
    },
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
            if (!VALID_GIT_TABS.includes(to.query.tab as typeof VALID_GIT_TABS[number])) {
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
      ],
    },
  ],
});

router.beforeEach(async (to) => {
  if (to.meta.public) {
    if (to.name === "login" && isLocalHost()) {
      await ensureLocalAuth();
      return { name: "home" };
    }
    return true;
  }

  if (isLocalHost()) {
    try {
      await ensureLocalAuth();
      await queryClient.ensureQueryData(lanSettingsQueryOptions());
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        return { name: "login", query: to.query };
      }
      throw err;
    }
  }

  try {
    await queryClient.ensureQueryData(lanSettingsQueryOptions());
    return true;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return { name: "login", query: to.query };
    }
    throw err;
  }
});

export default router;
