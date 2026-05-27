/**
 * Shiki entry for @pierre/diffs — allowlisted grammars only (see pierre-shiki-langs.ts).
 */
import {
  createBundledHighlighter,
  createCssVariablesTheme,
  createSingletonShorthands,
  getTokenStyleObject,
  stringifyTokenStyle,
} from "@shikijs/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import {
  PIERRE_SHIKI_LANG_IDS,
  type PierreShikiLangId,
} from "@/shared/lib/pierre-shiki-langs";

type LangLoader = () => Promise<{ default: unknown }>;

const langLoaders: Record<PierreShikiLangId, LangLoader> = {
  typescript: () => import("@shikijs/langs/typescript"),
  tsx: () => import("@shikijs/langs/tsx"),
  javascript: () => import("@shikijs/langs/javascript"),
  jsx: () => import("@shikijs/langs/jsx"),
  json: () => import("@shikijs/langs/json"),
  markdown: () => import("@shikijs/langs/markdown"),
  css: () => import("@shikijs/langs/css"),
  html: () => import("@shikijs/langs/html"),
  python: () => import("@shikijs/langs/python"),
  go: () => import("@shikijs/langs/go"),
  rust: () => import("@shikijs/langs/rust"),
  zsh: () => import("@shikijs/langs/zsh"),
  yaml: () => import("@shikijs/langs/yaml"),
  toml: () => import("@shikijs/langs/toml"),
};

const createHighlighter = createBundledHighlighter({
  langs: langLoaders,
  themes: {},
  engine: () => createJavaScriptRegexEngine(),
});

const shorthands = createSingletonShorthands(createHighlighter);

export const {
  codeToHtml,
  codeToHast,
  codeToTokens,
  codeToTokensBase,
  codeToTokensWithThemes,
  getLastGrammarState,
  getSingletonHighlighter,
} = shorthands;

export {
  createHighlighter,
  createCssVariablesTheme,
  getTokenStyleObject,
  stringifyTokenStyle,
};
export { normalizeTheme } from "shiki/core";
export { createJavaScriptRegexEngine } from "shiki/engine/javascript";
export { createJavaScriptRegexEngine as createOnigurumaEngine } from "shiki/engine/javascript";

export const bundledLanguages: Record<string, LangLoader> = langLoaders;
export const bundledLanguagesInfo: { id: string }[] = PIERRE_SHIKI_LANG_IDS.map((id) => ({
  id,
}));
export const bundledLanguagesAlias: Record<string, string> = {};
export const bundledLanguagesBase: Record<string, string> = {};

/** Pierre themes load via registerCustomTheme (@pierre/theme). */
export const bundledThemes: Record<string, () => Promise<unknown>> = {};
export const bundledThemesInfo: never[] = [];
