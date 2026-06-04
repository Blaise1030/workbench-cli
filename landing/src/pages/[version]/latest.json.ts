import type { APIRoute, GetStaticPaths } from 'astro';
import { fetchReleaseVersions, buildManifest } from '../../lib/versions';

export const getStaticPaths: GetStaticPaths = async () => {
  const versions = await fetchReleaseVersions();
  return versions.map(({ version, tag }) => ({
    params: { version },
    props: { tag },
  }));
};

export const GET: APIRoute = ({ params, props }) => {
  const { version } = params;
  const { tag } = props as { tag: string };
  const manifest = buildManifest(version!, tag);
  return new Response(JSON.stringify(manifest, null, 2) + '\n', {
    headers: { 'Content-Type': 'application/json' },
  });
};
