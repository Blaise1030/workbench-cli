import type { APIRoute } from 'astro';
import { buildManifest, resolveLatestRelease } from '../lib/versions';

export const GET: APIRoute = async () => {
  const latest = await resolveLatestRelease();
  if (!latest) {
    return new Response(JSON.stringify({ error: 'no release found' }) + '\n', {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const manifest = buildManifest(latest.version, latest.tag);
  return new Response(JSON.stringify(manifest, null, 2) + '\n', {
    headers: { 'Content-Type': 'application/json' },
  });
};
