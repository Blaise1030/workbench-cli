import { randomBytes } from "node:crypto";

export interface Session {
  sid: string;
  active: boolean;
}

export function createSession(): Session {
  return { sid: randomBytes(32).toString("hex"), active: false };
}

export function activateSession(session: Session): void {
  session.active = true;
}

export function deactivateSession(session: Session): void {
  session.active = false;
}

export function validateSession(session: Session, sid: string): boolean {
  return session.active && session.sid === sid;
}
