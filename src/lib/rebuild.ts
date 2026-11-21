/*
 * The daily rebuild. The GitHub activity on the home page is fetched while the
 * site is built, so the host's scheduler calls this once a day and it asks the
 * host for a fresh build. Both the scheduler's secret and the build hook's
 * address are private settings; neither is ever echoed.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

export type RebuildEnv = { CRON_SECRET?: string; DEPLOY_HOOK_URL?: string };

const TIMEOUT_MS = 10_000;

const answer = (status: number, body: string) =>
  new Response(JSON.stringify({ result: body }), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });

/** Compared in constant time, on digests so the lengths never differ. */
function same(given: string, expected: string): boolean {
  const digest = (text: string) => createHash('sha256').update(text).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

export async function handleRebuild(request: Request, env: RebuildEnv, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'GET') return answer(405, 'method');
  // The host's scheduler sends the secret this way. With no secret set, nobody is let in.
  const given = request.headers.get('authorization') ?? '';
  if (!env.CRON_SECRET || !same(given, `Bearer ${env.CRON_SECRET}`)) return answer(401, 'unauthorized');

  let hook: URL;
  try {
    hook = new URL(env.DEPLOY_HOOK_URL ?? '');
    if (hook.protocol !== 'https:') throw new Error('not https');
  } catch {
    return answer(503, 'unavailable');
  }

  try {
    const response = await fetchImpl(hook.href, { method: 'POST', signal: AbortSignal.timeout(TIMEOUT_MS) });
    return response.ok ? answer(200, 'started') : answer(502, 'failed');
  } catch {
    return answer(502, 'failed');
  }
}
