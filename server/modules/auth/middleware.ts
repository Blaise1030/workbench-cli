import type { Context, Next } from "hono";
import type { Session } from "./session.js";
import { validateSession } from "./session.js";

function parseSid(cookieHeader: string | undefined): string {
  if (!cookieHeader) return "";
  const match = cookieHeader.match(/(?:^|;\s*)sid=([^;]+)/);
  return match?.[1] ?? "";
}

export function requireSession(session: Session) {
  return async (c: Context, next: Next) => {
    const sid = parseSid(c.req.header("cookie"));
    if (!validateSession(session, sid)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  };
}
