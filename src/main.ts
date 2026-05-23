import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { createApp } from "vue";
import App from "./App.vue";
import { queryClient } from "@/lib/query-client";
import router from "./router";
import "./assets/index.css";

const app = createApp(App);
app.use(VueQueryPlugin, { queryClient });
app.use(router);
app.mount("#app");
