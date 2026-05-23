import { createRouter, createWebHistory } from "vue-router";
import LoginView from "@/views/LoginView.vue";
import TerminalView from "@/views/TerminalView.vue";
import SettingsView from "@/views/SettingsView.vue";
import { lanSettingsQueryOptions } from "@/api/settings";
import { queryClient } from "@/lib/query-client";
import { ApiError } from "@/lib/api-error";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", name: "login", component: LoginView, meta: { public: true } },
    { path: "/", name: "terminal", component: TerminalView },
    { path: "/settings", name: "settings", component: SettingsView },
  ],
});

router.beforeEach(async (to) => {
  if (to.meta.public) return true;
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
