// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://www.daryakruk.ai',
  trailingSlash: 'ignore',
  integrations: [react(), keystatic()],
  adapter: vercel(),
  image: {
    responsiveStyles: true,
  },
});
