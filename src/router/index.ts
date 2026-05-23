import { createRouter, createWebHistory } from "vue-router";
import LoginView from "@/views/LoginView.vue";
import TerminalView from "@/views/TerminalView.vue";
import SettingsView from "@/views/SettingsView.vue";

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
  const res = await fetch("/api/settings/lan", { credentials: "include" });
  if (res.status === 401) {
    return { name: "login", query: to.query };
  }
  return true;
});

export default router;
