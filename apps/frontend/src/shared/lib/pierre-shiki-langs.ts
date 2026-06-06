import type { SupportedLanguages } from "@pierre/diffs";

/**
 * Shiki grammars shipped in production. Keep this list small — each id is a lazy chunk.
 * Unknown extensions fall back to plain text via Pierre's file-type detection.
 */
export const PIERRE_SHIKI_LANG_IDS = [
  "typescript",
  "tsx",
  "javascript",
  "jsx",
  "json",
  "markdown",
  "css",
  "html",
  "python",
  "go",
  "rust",
  "zsh",
  "yaml",
  "toml",
] as const;

export type PierreShikiLangId = (typeof PIERRE_SHIKI_LANG_IDS)[number];

export const PIERRE_SHIKI_LANGS: SupportedLanguages[] = [
  ...PIERRE_SHIKI_LANG_IDS,
];

const allowed = new Set<string>(PIERRE_SHIKI_LANG_IDS);

export function isAllowedShikiLang(id: string): boolean {
  return allowed.has(id);
}
