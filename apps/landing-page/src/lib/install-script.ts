import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const template = readFileSync(
  join(process.cwd(), 'templates', 'install.sh'),
  'utf8',
);

export function renderInstallScript(manifestUrl: string): string {
  return template.replace(
    /MANIFEST_URL="\$\{WORKBENCH_MANIFEST_URL:-[^"]+\}"/,
    `MANIFEST_URL="\${WORKBENCH_MANIFEST_URL:-${manifestUrl}}"`,
  );
}
