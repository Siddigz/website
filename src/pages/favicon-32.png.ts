// The site's icon as a small picture, for browsers that do not take the drawn one.
import type { APIRoute } from 'astro';
import { faviconPng } from '../lib/favicon';
import { getSite } from '../lib/site';

export const GET: APIRoute = async () => {
  const { name } = await getSite();
  return new Response(new Uint8Array(await faviconPng(`${name.first[0]}${name.last[0]}`, 32)), { headers: { 'content-type': 'image/png' } });
};
