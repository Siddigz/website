// Second step of the email reveal: trades a fresh token for the contact
// address, which is a private setting on the host and nowhere else.
import type { APIRoute } from 'astro';
import { handleAddress } from '../../../lib/contact-handlers';

export const prerender = false;

export const ALL: APIRoute = ({ request }) => handleAddress(request, process.env, Date.now());
