// First step of the email reveal: hands out a token that lasts one minute.
// Answered by the server on each request, never built ahead of time.
import type { APIRoute } from 'astro';
import { handleToken } from '../../../lib/contact-handlers';

export const prerender = false;

export const ALL: APIRoute = ({ request }) => handleToken(request, process.env, Date.now());
