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
  integrations: [sitemap(), react()],
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
