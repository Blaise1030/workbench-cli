import { createRouter, createWebHistory } from "vue-router";
import LoginView from "@/views/LoginView.vue";
import WorkspaceView from "@/views/WorkspaceView.vue";
import SettingsView from "@/views/SettingsView.vue";
import { ensureLocalAuth } from "@/api/auth";
import { lanSettingsQueryOptions } from "@/api/settings";
import { queryClient } from "@/lib/query-client";
import { ApiError } from "@/lib/api-error";
import { isLocalHost } from "@/lib/is-local-host";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", name: "login", component: LoginView, meta: { public: true } },
    { path: "/", name: "home", component: WorkspaceView },
    { path: "/w/:worktreeId", name: "workspace", component: WorkspaceView },
    { path: "/settings", name: "settings", component: SettingsView },
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
