import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

type SectionMeta = {
  heading?: string;
  shortcut?: { before: string; keys: string[]; after: string };
  link?: { label: string; href: string };
};

function parseSections(body: string, sectionMeta: SectionMeta[]) {
  const chunks = body.split(/\n## /);

  return chunks
    .map((chunk, i) => {
      let markdownHeading: string | undefined;
      let text: string;

      if (i === 0) {
        text = chunk;
      } else {
        const nl = chunk.indexOf('\n');
        markdownHeading = nl > -1 ? chunk.slice(0, nl).trim() : chunk.trim();
        text = nl > -1 ? chunk.slice(nl + 1) : '';
      }

      const paragraphs = text
        .split(/\n\n+/)
        .map(p => p.trim())
        .filter(Boolean);

      if (paragraphs.length === 0) return null;

      const meta = sectionMeta[i] ?? {};
      const heading = meta.heading ?? markdownHeading;

      return {
        ...(heading ? { heading } : {}),
        paragraphs,
        ...(meta.shortcut ? { shortcut: meta.shortcut } : {}),
        ...(meta.link ? { link: meta.link } : {}),
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
}

export const GET: APIRoute = async () => {
  const entries = await getCollection('whats-new');

  entries.sort((a, b) => b.data.publishedAt.localeCompare(a.data.publishedAt));

  const result = entries.map(entry => {
    const { title, summary, publishedAt, version, heroIcon, image, sections } = entry.data;

    return {
      id: entry.slug,
      title,
      summary,
      publishedAt,
      ...(version ? { version } : {}),
      ...(heroIcon ? { heroIcon } : {}),
      ...(image ? { image } : {}),
      sections: parseSections(entry.body, sections),
    };
  });

  return new Response(JSON.stringify(result, null, 2) + '\n', {
    headers: { 'Content-Type': 'application/json' },
  });
};
