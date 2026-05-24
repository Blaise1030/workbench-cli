import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireSession } from "../auth/middleware.js";
import type { Session } from "../auth/session.js";
import { putKeybindingsSchema } from "../../schemas/api.js";
import type { KeybindingsMap } from "../../schemas/api.js";
import { getKeybindings, putKeybindings } from "./store.js";

export function createKeybindingsRouter(session: Session) {
  return new Hono()
    .use("*", requireSession(session))
    .get("/", async (c) => {
      const map = await getKeybindings();
      return c.json(map);
    })
    .put("/", zValidator("json", putKeybindingsSchema), async (c) => {
      const map = c.req.valid("json") as KeybindingsMap;
      await putKeybindings(map);
      return c.json(map);
    });
}
