/** xterm only parses #rgb[a], #rrggbb[aa], and rgba() — not color(srgb …) from getComputedStyle. */
export function cssColorToXtermHex(cssColor: string, fallback: string): string {
  if (!cssColor || cssColor === "transparent" || cssColor === "rgba(0, 0, 0, 0)") {
    return fallback;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return fallback;

  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = cssColor;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}${hex(a)}`;
}

/** Resolve a CSS custom property (including color-mix) to an xterm-safe #rrggbbaa hex. */
export function resolveXtermCssVar(name: string, fallback: string): string {
  const probe = document.createElement("span");
  probe.style.cssText =
    "position:absolute;visibility:hidden;pointer-events:none;background:var(" +
    name +
    ")";
  document.documentElement.appendChild(probe);
  const resolved = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return cssColorToXtermHex(resolved, fallback);
}

/** Fallback selection colors when CSS var resolution fails. */
export const TERMINAL_SELECTION = {
  light: { active: "#0078d473", inactive: "#0078d440" },
  dark: { active: "#ffffff59", inactive: "#ffffff2e" },
} as const;

export function terminalSelectionColors(isDark: boolean) {
  const fallback = isDark ? TERMINAL_SELECTION.dark : TERMINAL_SELECTION.light;
  return {
    selectionBackground: resolveXtermCssVar(
      "--terminal-selection-bg",
      fallback.active,
    ),
    selectionInactiveBackground: resolveXtermCssVar(
      "--terminal-selection-inactive-bg",
      fallback.inactive,
    ),
  };
}
