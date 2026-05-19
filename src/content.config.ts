import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const postSchema = z.object({
  title: z.string(),
  description: z.string(),
  publishDate: z.date(),
  updatedDate: z.date().optional(),
  tags: z.array(z.string()).optional().default([]),
  canonicalURL: z.string().url().optional(),
});

export const collections = {
  playbooks: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/playbooks' }),
    schema: postSchema,
  }),
  'lab-notes': defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/lab-notes' }),
    schema: postSchema,
  }),
};
