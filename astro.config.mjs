import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://crunchcodelabs.github.io',
  output: 'static',
  integrations: [sitemap()],
  build: { format: 'directory' },
});
