// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://jjcruzgalera.com',
  redirects: {
    '/writing': '/playbooks',
  },
  integrations: [
    sitemap({
      filter: page => !page.includes('/tools/funnel-diagnostic-draft'),
    }),
    react(),
  ],
  markdown: {
    smartypants: false,
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
