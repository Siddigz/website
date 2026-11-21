// The link preview picture for the home page (and any page without its own). Drawn while the site is built.
import type { APIRoute } from 'astro';
import { renderOg } from '../../lib/og';
import { homeCard } from '../../lib/og-cards';

export const GET: APIRoute = async () => new Response(new Uint8Array(await renderOg(await homeCard())), { headers: { 'content-type': 'image/png' } });
