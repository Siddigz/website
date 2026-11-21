// The icon a phone shows when the site is added to its home screen. The phone rounds the corners itself.
import type { APIRoute } from 'astro';
import { faviconPng } from '../lib/favicon';
import { getSite } from '../lib/site';

export const GET: APIRoute = async () => {
  const { name } = await getSite();
  return new Response(new Uint8Array(await faviconPng(`${name.first[0]}${name.last[0]}`, 180, { square: true })), {
    headers: { 'content-type': 'image/png' },
  });
};
