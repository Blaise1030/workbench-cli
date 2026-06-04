import type { APIRoute, GetStaticPaths } from 'astro';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchReleaseVersions, PAGES_BASE } from '../../lib/versions';

const template = readFileSync(
  join(process.cwd(), '..', 'docs', 'install.sh'),
  'utf8'
);

export const getStaticPaths: GetStaticPaths = async () => {
  const versions = await fetchReleaseVersions();
  return versions.map(({ version, tag }) => ({
    params: { version },
    props: { tag },
  }));
};

export const GET: APIRoute = ({ params }) => {
  const { version } = params;
  const manifestUrl = `${PAGES_BASE}/${version}/latest.json`;
  const installSh = template.replace(
    /MANIFEST_URL="\$\{WORKBENCH_MANIFEST_URL:-[^"]+\}"/,
    `MANIFEST_URL="\${WORKBENCH_MANIFEST_URL:-${manifestUrl}}"`
  );
  return new Response(installSh, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
