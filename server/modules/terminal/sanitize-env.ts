const SENSITIVE_ENV_KEY = /token|secret|password|api_key/i;

export function sanitizeEnv(env: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter(([key]) => !SENSITIVE_ENV_KEY.test(key)),
  );
}
