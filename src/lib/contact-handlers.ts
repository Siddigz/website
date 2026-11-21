/*
 * The two addresses behind the email button. The contact address is only ever
 * a private setting on the host: it is not in the repo, not in the built
 * pages, and is sent only in answer to a fresh token.
 *
 *   POST /api/contact/token    ->  { token }
 *   POST /api/contact/address  { token }  ->  { address }
 *
 * No answer is ever cached, and no error says anything about the settings.
 */
import { issueToken, verifyToken } from './contact-token';
import { createLimiter } from './rate-limit';

export type ContactEnv = { CONTACT_ADDRESS?: string; CONTACT_TOKEN_SECRET?: string };

const MAX_BODY_BYTES = 1024;
// Shared by both addresses: ten calls a minute from one client.
const allow = createLimiter(10, 60_000);

function json(status: number, body: Record<string, string>, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', ...extra },
  });
}

/** The caller's address as the host reports it. Good enough to count calls by. */
function clientOf(request: Request): string {
  return request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

/** A page on another site must not be able to make a visitor's browser ask for the address. */
function fromThisSite(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return false;
  const site = request.headers.get('sec-fetch-site');
  return !site || site === 'same-origin';
}

/** The checks both addresses share. A response means "stop here"; settings mean "go on". */
function guard(request: Request, env: ContactEnv, now: number): Response | { address: string; secret: string } {
  if (request.method !== 'POST') return json(405, { error: 'method' }, { allow: 'POST' });
  if (!fromThisSite(request)) return json(403, { error: 'forbidden' });
  if (!allow(clientOf(request), now)) return json(429, { error: 'slow down' }, { 'retry-after': '60' });
  if (!env.CONTACT_ADDRESS || !env.CONTACT_TOKEN_SECRET) return json(503, { error: 'unavailable' });
  return { address: env.CONTACT_ADDRESS, secret: env.CONTACT_TOKEN_SECRET };
}

export function handleToken(request: Request, env: ContactEnv, now: number): Response {
  const settings = guard(request, env, now);
  if (settings instanceof Response) return settings;
  return json(200, { token: issueToken(settings.secret, now) });
}

export async function handleAddress(request: Request, env: ContactEnv, now: number): Promise<Response> {
  const settings = guard(request, env, now);
  if (settings instanceof Response) return settings;

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return json(400, { error: 'bad request' });
    body = JSON.parse(text);
  } catch {
    return json(400, { error: 'bad request' });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return json(400, { error: 'bad request' });

  if (!verifyToken(settings.secret, (body as { token?: unknown }).token, now)) return json(403, { error: 'forbidden' });
  return json(200, { address: settings.address });
}
