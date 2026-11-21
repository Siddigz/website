// The site's icon, as shapes. Drawn while the site is built from the initials in site.yaml.
import type { APIRoute } from 'astro';
import { faviconSvg } from '../lib/favicon';
import { getSite } from '../lib/site';

export const GET: APIRoute = async () => {
  const { name } = await getSite();
  return new Response(await faviconSvg(`${name.first[0]}${name.last[0]}`), { headers: { 'content-type': 'image/svg+xml' } });
};
