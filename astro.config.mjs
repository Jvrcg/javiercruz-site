// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  site: 'https://jjcruzgalera.com',
  redirects: {
    '/writing': '/playbooks',
  },
  integrations: [
    sitemap({
      // Static HTML in public/ is not built by Astro, so the sitemap
      // integration cannot see it. List those pages here.
      customPages: ['https://jjcruzgalera.com/guides/conversion-tracking'],
    }),
    react(),
  ],
  // No `output` set: Astro defaults to 'static', so every page is prerendered
  // at build time. The adapter only enables on-demand rendering for routes
  // that explicitly opt out with `export const prerender = false`
  // (currently just src/pages/api/contact.ts).
  adapter: vercel(),
  markdown: {
    smartypants: false,
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
