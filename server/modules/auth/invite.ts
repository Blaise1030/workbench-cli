import { randomBytes } from "node:crypto";

const INVITE_TTL_MS = 15 * 60 * 1000;

export interface InviteToken {
  value: string;
  expiresAt: number;
  used: boolean;
}

export function createInvite(): InviteToken {
  return {
    value: randomBytes(32).toString("hex"),
    expiresAt: Date.now() + INVITE_TTL_MS,
    used: false,
  };
}

export function isInviteValid(invite: InviteToken | null, input: string): boolean {
  if (!invite || invite.used) return false;
  if (Date.now() >= invite.expiresAt) return false;
  return input === invite.value;
}

export function consumeInvite(invite: InviteToken): void {
  invite.used = true;
}
