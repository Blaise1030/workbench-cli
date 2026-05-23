export interface SessionToken {
  value: string;
  consumed: boolean;
}

export function createToken(): SessionToken {
  return { value: crypto.randomUUID(), consumed: false };
}

export function validateToken(token: SessionToken, input: string): boolean {
  if (token.consumed || input !== token.value) return false;
  token.consumed = true;
  return true;
}
