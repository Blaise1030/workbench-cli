const STORAGE_KEY = "settingsReturnTo";

export function isSettingsPath(path: string): boolean {
  return path === "/settings" || path.startsWith("/settings/");
}

export function rememberSettingsReturnRoute(fromPath: string): void {
  if (!isSettingsPath(fromPath)) {
    sessionStorage.setItem(STORAGE_KEY, fromPath);
  }
}

export function getSettingsReturnRoute(): string | null {
  const path = sessionStorage.getItem(STORAGE_KEY);
  if (!path || isSettingsPath(path)) return null;
  return path;
}

export function resolveSettingsBackTarget(): string {
  const saved = getSettingsReturnRoute();
  if (saved) return saved;

  const lastWorktreeId = localStorage.getItem("lastWorktreeId");
  if (lastWorktreeId) {
    return `/w/${lastWorktreeId}`;
  }

  return "/";
}
