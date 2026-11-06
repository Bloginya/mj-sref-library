import type { APIRoute } from 'astro';
import { getProjects } from '../lib/content';

export const GET: APIRoute = async ({ site }) => {
  const projects = await getProjects();
  const urls = ['/', '/portfolio', ...projects.map((p) => `/portfolio/${p.slug}`)];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${new URL(u, site)}</loc></url>`).join('\n')}
</urlset>`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
};
