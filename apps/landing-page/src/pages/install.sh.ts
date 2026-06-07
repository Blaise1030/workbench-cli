import type { APIRoute } from 'astro';
import { renderInstallScript } from '../lib/install-script';
import { PAGES_BASE } from '../lib/versions';

export const GET: APIRoute = () => {
  const manifestUrl = `${PAGES_BASE}/latest.json`;
  return new Response(renderInstallScript(manifestUrl), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
