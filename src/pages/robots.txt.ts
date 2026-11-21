// Tells search engines the whole site may be read, except the addresses the
// server answers on request, and where the list of pages is.
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) =>
  new Response(['User-agent: *', 'Allow: /', 'Disallow: /api/', '', `Sitemap: ${new URL('sitemap-index.xml', site)}`, ''].join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
