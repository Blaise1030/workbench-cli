import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const REPO = 'Blaise1030/workbench-cli';
export const PAGES_BASE = (import.meta.env.SITE as string | undefined)?.replace(/\/$/, '') ?? 'https://apps-landing-page.pages.dev';

export interface VersionEntry {
  version: string;
  tag: string;
}

export function normalizeReleaseTag(tag: string): string {
  const trimmed = tag.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('workbench-v')) return trimmed;
  if (trimmed.startsWith('v')) return trimmed;
  return `v${trimmed}`;
}

export function versionFromTag(tag: string): string {
  return normalizeReleaseTag(tag).replace(/^(?:workbench-)?v/, '');
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
        version: versionFromTag(r.tag_name),
      }));
  } catch {
    return [];
  }
}

function fallbackFromPackageJson(): VersionEntry | null {
  try {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), '../../package.json'), 'utf8'),
    ) as { version?: string };
    if (!pkg.version) return null;
    return { version: pkg.version, tag: `v${pkg.version}` };
  } catch {
    return null;
  }
}

/** Resolve the latest release for root /latest.json (CI tag override → GitHub API → package.json). */
export async function resolveLatestRelease(): Promise<VersionEntry | null> {
  const tagOverride = import.meta.env.PUBLIC_RELEASE_TAG?.trim();
  if (tagOverride) {
    const tag = normalizeReleaseTag(tagOverride);
    return { tag, version: versionFromTag(tag) };
  }

  const versions = await fetchReleaseVersions();
  if (versions[0]) return versions[0];

  return fallbackFromPackageJson();
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
