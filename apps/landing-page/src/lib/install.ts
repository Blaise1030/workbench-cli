/** GitHub Pages project site root. */
export const PAGES_BASE = 'https://blaise1030.github.io/workbench-cli';

/** Stable install script (latest release). */
export const INSTALL_SCRIPT_URL = `${PAGES_BASE}/install.sh`;

export const INSTALL_OPTIONS_URL = `${PAGES_BASE}/`;

/** Install script path on this site. */
export const INSTALL_SCRIPT_PATH = '/install.sh';

/** Dev install for a specific preview version (e.g. 0.1.1-dev-abc1234). */
export function devInstallScriptUrl(version: string): string {
  return `${PAGES_BASE}/${version}/install.sh`;
}

export function installCmdFor(version?: string): string {
  const url = version?.trim() ? devInstallScriptUrl(version.trim()) : INSTALL_SCRIPT_URL;
  return `curl -fsSL ${url} | sh`;
}

/** Set at build time on PR preview workflows. */
const devVersion = import.meta.env.PUBLIC_DEV_VERSION?.trim() || '';

export const isDevPreviewBuild = Boolean(devVersion);

/** Install command shown on the landing page. */
export const installCmd = installCmdFor(devVersion || undefined);

/** Human-readable label for the active install channel. */
export const installChannelLabel = devVersion
  ? `dev ${devVersion}`
  : 'latest release';
