import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";

const EXTRA_GO_DIRS = [
  "/usr/local/go/bin",
  "/opt/homebrew/bin",
  "/usr/local/bin",
];

function canExecute(path) {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolveGoBin() {
  const pathDirs = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  for (const dir of [...pathDirs, ...EXTRA_GO_DIRS]) {
    const candidate = join(dir, "go");
    if (canExecute(candidate)) return candidate;
  }
  return null;
}

export function goMissingMessage() {
  return [
    "Go was not found.",
    "",
    "Install Go, then make sure the `go` binary is on PATH.",
    "macOS options:",
    "  brew install go",
    "  or install from https://go.dev/dl/",
    "",
    "If Go is already installed from go.dev, add this to your shell profile:",
    "  export PATH=\"/usr/local/go/bin:$PATH\"",
  ].join("\n");
}
