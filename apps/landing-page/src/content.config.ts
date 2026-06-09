import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const docs = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number(),
  }),
});

const SectionMetaSchema = z.object({
  heading: z.string().optional(),
  shortcut: z.object({
    before: z.string(),
    keys: z.array(z.string()),
    after: z.string(),
  }).optional(),
  link: z.object({
    label: z.string(),
    href: z.string(),
  }).optional(),
});

const whatsNew = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/whats-new' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    publishedAt: z.string(),
    version: z.string().optional(),
    heroIcon: z.enum(['bot', 'folder']).optional(),
    image: z.string().optional(),
    sections: z.array(SectionMetaSchema).default([]),
  }),
});

export const collections = { docs, 'whats-new': whatsNew };
