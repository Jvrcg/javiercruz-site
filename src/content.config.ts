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
  writing: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/writing' }),
    schema: postSchema,
  }),
  'lab-notes': defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/lab-notes' }),
    schema: postSchema,
  }),
};
