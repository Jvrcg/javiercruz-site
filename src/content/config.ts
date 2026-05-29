import { defineCollection, z } from 'astro:content';

const playbooks = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.date(),
    updatedDate: z.date(),
    tags: z.array(z.string()),
    canonicalURL: z.string().optional(),
  }),
});

export const collections = { playbooks };
