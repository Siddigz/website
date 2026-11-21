import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { handleRebuild } from '../../src/lib/rebuild';

const SECRET = 'a-cron-secret-for-tests-only';
const HOOK = 'https://hooks.example.test/deploy/abc123';
const env = { CRON_SECRET: SECRET, DEPLOY_HOOK_URL: HOOK };
const call = (authorization?: string, method = 'GET') =>
  new Request('https://site.test/api/rebuild', { method, headers: authorization ? { authorization } : {} });
const hook = (status = 201) => vi.fn(async () => new Response('{"job":{"id":"x"}}', { status })) as unknown as typeof fetch;

describe('handleRebuild', () => {
  it.each([
    ['no authorization', undefined],
    ['the wrong secret', 'Bearer not-the-secret'],
    ['the secret without the word Bearer', SECRET],
    ['a longer value that starts with the secret', `Bearer ${SECRET}x`],
  ])('answers 401 for %s, and starts nothing', async (_name, authorization) => {
    const fetchImpl = hook();
    const response = await handleRebuild(call(authorization), env, fetchImpl);
    expect(response.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('answers 401 when no secret is set, even for "Bearer undefined" or an empty one', async () => {
    const fetchImpl = hook();
    for (const authorization of [undefined, 'Bearer undefined', 'Bearer ', 'Bearer']) {
      for (const secret of [undefined, '']) {
        const response = await handleRebuild(call(authorization), { CRON_SECRET: secret, DEPLOY_HOOK_URL: HOOK }, fetchImpl);
        expect(response.status).toBe(401);
      }
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('starts one new build for the right secret', async () => {
    const fetchImpl = hook();
    const response = await handleRebuild(call(`Bearer ${SECRET}`), env, fetchImpl);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [address, init] = (fetchImpl as any).mock.calls[0];
    expect(address).toBe(HOOK);
    expect(init.method).toBe('POST');
  });

  it.each([
    ['the hook answers with an error', hook(500)],
    ['the hook cannot be reached', vi.fn(async () => Promise.reject(new Error(`could not reach ${HOOK}`))) as unknown as typeof fetch],
  ])('answers 502 when %s, without the hook’s address', async (_name, fetchImpl) => {
    const response = await handleRebuild(call(`Bearer ${SECRET}`), env, fetchImpl);
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain('hooks.example.test');
    expect(text).not.toContain(SECRET);
  });

  it('answers 503 when the hook is not set or is not an https address', async () => {
    const fetchImpl = hook();
    for (const address of [undefined, '', 'http://hooks.example.test/deploy', 'not an address']) {
      const response = await handleRebuild(call(`Bearer ${SECRET}`), { CRON_SECRET: SECRET, DEPLOY_HOOK_URL: address }, fetchImpl);
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain('example.test');
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('answers only GET, which is how the host’s scheduler calls it', async () => {
    const fetchImpl = hook();
    const response = await handleRebuild(call(`Bearer ${SECRET}`, 'POST'), env, fetchImpl);
    expect(response.status).toBe(405);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('the schedule', () => {
  it('calls the rebuild address once a day at 10:00 UTC', () => {
    const { crons } = JSON.parse(readFileSync('vercel.json', 'utf8'));
    expect(crons).toEqual([{ path: '/api/rebuild', schedule: '0 10 * * *' }]);
  });
});
