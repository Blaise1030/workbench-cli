import { registerCustomCSSVariableTheme } from "@pierre/diffs";

/**
 * Pierre Shiki themes that reference `--diffs-*` tokens bridged from shadcn CSS variables
 * on `.git-diff-code-view` / `.file-preview-code-view` (see index.css).
 */
const SHADCN_SYNTAX_DEFAULTS = {
  foreground: "var(--foreground)",
  background: "var(--background)",
  "ansi-black": "var(--foreground)",
  "ansi-red": "var(--destructive)",
  "ansi-green": "var(--diff-addition)",
  "ansi-yellow": "var(--muted-foreground)",
  "ansi-blue": "var(--primary)",
  "ansi-magenta": "var(--primary)",
  "ansi-cyan": "var(--primary)",
  "ansi-white": "var(--muted-foreground)",
  "ansi-bright-black": "var(--muted-foreground)",
  "ansi-bright-red": "var(--destructive)",
  "ansi-bright-green": "var(--diff-addition)",
  "ansi-bright-yellow": "var(--muted-foreground)",
  "ansi-bright-blue": "var(--primary)",
  "ansi-bright-magenta": "var(--primary)",
  "ansi-bright-cyan": "var(--primary)",
  "ansi-bright-white": "var(--foreground)",
  "token-comment": "var(--muted-foreground)",
  "token-string": "var(--foreground)",
  "token-constant": "var(--muted-foreground)",
  "token-keyword": "var(--primary)",
  "token-parameter": "var(--muted-foreground)",
  "token-function": "var(--primary)",
  "token-string-expression": "var(--foreground)",
  "token-punctuation": "var(--muted-foreground)",
  "token-link": "var(--primary)",
  "token-inserted": "var(--diff-addition)",
  "token-deleted": "var(--destructive)",
  "token-changed": "var(--primary)",
} as const;

/** Morning-theme literals used only when shadcn vars are unavailable (e.g. SSR). */
const LIGHT_FALLBACKS = {
  ...SHADCN_SYNTAX_DEFAULTS,
  foreground: "oklch(0.22 0.008 245)",
  background: "oklch(0.96 0.01 245)",
  "ansi-red": "oklch(0.577 0.245 27.325)",
  "ansi-green": "oklch(0.48 0.14 145)",
  "token-keyword": "oklch(0.28 0.02 245)",
  "token-function": "oklch(0.28 0.02 245)",
  "token-link": "oklch(0.28 0.02 245)",
  "token-inserted": "oklch(0.48 0.14 145)",
  "token-deleted": "oklch(0.577 0.245 27.325)",
  "token-changed": "oklch(0.28 0.02 245)",
} as const;

/** Evening-theme literals for dark fallback. */
const DARK_FALLBACKS = {
  ...SHADCN_SYNTAX_DEFAULTS,
  foreground: "oklch(0.88 0.01 68)",
  background: "oklch(0.24 0.015 55)",
  "ansi-red": "oklch(0.704 0.191 22.216)",
  "ansi-green": "oklch(0.62 0.12 150)",
  "token-keyword": "oklch(0.78 0.04 70)",
  "token-function": "oklch(0.78 0.04 70)",
  "token-link": "oklch(0.78 0.04 70)",
  "token-inserted": "oklch(0.62 0.12 150)",
  "token-deleted": "oklch(0.704 0.191 22.216)",
  "token-changed": "oklch(0.78 0.04 70)",
} as const;

let registered = false;

export function registerPierreShadcnThemes(): void {
  if (registered) return;
  registered = true;
  registerCustomCSSVariableTheme("pierre-shadcn-light", LIGHT_FALLBACKS);
  registerCustomCSSVariableTheme("pierre-shadcn-dark", DARK_FALLBACKS);
}

registerPierreShadcnThemes();
