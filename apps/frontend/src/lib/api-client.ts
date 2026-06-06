import { hc } from "hono/client";
import type { ApiRouter } from "@server/api/index";

export const apiClient = hc<ApiRouter>("/api", {
  init: {
    credentials: "include",
  },
});
