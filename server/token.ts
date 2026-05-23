import { randomBytes } from "node:crypto";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface SessionToken {
  value: string;
  expiresAt: number;
}

export function createToken(): SessionToken {
  return {
    value: randomBytes(32).toString("hex"),
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
}

export function isTokenExpired(token: SessionToken): boolean {
  return Date.now() >= token.expiresAt;
}

export function isTokenValid(token: SessionToken, input: string): boolean {
  return !isTokenExpired(token) && input === token.value;
}
