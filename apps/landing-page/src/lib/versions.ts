export const REPO = 'Blaise1030/workbench-cli';
export const PAGES_BASE = (import.meta.env.SITE as string | undefined)?.replace(/\/$/, '') ?? 'https://apps-landing-page.pages.dev';

export interface VersionEntry {
  version: string;
  tag: string;
}

/** Fetch all stable release versions from GitHub API at build time. */
export async function fetchReleaseVersions(): Promise<VersionEntry[]> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases`,
      { headers: { Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) return [];
    const releases: { tag_name: string }[] = await res.json();
    return releases
      .filter((r) => /^(?:workbench-)?v\d+\.\d+\.\d+$/.test(r.tag_name))
      .map((r) => ({
        tag: r.tag_name,
        version: r.tag_name.replace(/^(?:workbench-)?v/, ''),
      }));
  } catch {
    return [];
  }
}

export function buildManifest(version: string, tag: string) {
  const base = `https://github.com/${REPO}/releases/download/${tag}`;
  return {
    version,
    assets: {
      'linux-x86_64': `${base}/workbench-cli-linux-x86_64.tar.gz`,
      'linux-aarch64': `${base}/workbench-cli-linux-aarch64.tar.gz`,
      'macos-x86_64': `${base}/workbench-cli-macos-x86_64.tar.gz`,
      'macos-aarch64': `${base}/workbench-cli-macos-aarch64.tar.gz`,
    },
  };
}
