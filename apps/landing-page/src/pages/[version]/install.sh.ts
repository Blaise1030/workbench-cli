import type { APIRoute, GetStaticPaths } from 'astro';
import { renderInstallScript } from '../../lib/install-script';
import { fetchReleaseVersions, PAGES_BASE } from '../../lib/versions';

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
  return new Response(renderInstallScript(manifestUrl), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
