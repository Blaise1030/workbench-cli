import type { ThemesType } from "@pierre/diffs";

/** Matches CodeView `theme` option in git + file preview. */
export const PIERRE_DIFF_THEME: ThemesType = {
  dark: "pierre-dark",
  light: "pierre-light",
};

/** Diff rendering tuned for worker + allowlisted Shiki grammars. */
export const PIERRE_DIFF_RENDER_OPTIONS = {
  useTokenTransformer: true,
} as const;
