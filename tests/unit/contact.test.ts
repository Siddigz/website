import { describe, it, expect } from 'vitest';
import { TOKEN_LIFETIME_MS, issueToken, verifyToken } from '../../src/lib/contact-token';
import { createLimiter } from '../../src/lib/rate-limit';
import { handleAddress, handleToken, type ContactEnv } from '../../src/lib/contact-handlers';

const SECRET = 'a-secret-for-tests-only';
const NOW = 1_800_000_000_000;
// Never a real address, and never written whole, so no file in the repo holds one.
const ADDRESS = ['someone', 'example.test'].join('@');
const env: ContactEnv = { CONTACT_ADDRESS: ADDRESS, CONTACT_TOKEN_SECRET: SECRET };
const SITE = 'https://site.test';

let client = 0;
/** A request from a client no other test has used, so the rate limit starts fresh. */
function request(path: string, init: RequestInit & { ip?: string } = {}): Request {
  const { ip = `203.0.113.${(client += 1)}`, headers, ...rest } = init;
  return new Request(`${SITE}${path}`, {
    method: 'POST',
    ...rest,
    headers: { origin: SITE, 'x-forwarded-for': ip, ...(headers as Record<string, string>) },
  });
}
const withToken = (token: unknown, init: RequestInit & { ip?: string } = {}) =>
  request('/api/contact/address', { body: JSON.stringify({ token }), ...init });

describe('contact token', () => {
  it('lasts one minute', () => {
    expect(TOKEN_LIFETIME_MS).toBe(60_000);
    const token = issueToken(SECRET, NOW);
    expect(verifyToken(SECRET, token, NOW)).toBe(true);
    expect(verifyToken(SECRET, token, NOW + 59_999)).toBe(true);
    expect(verifyToken(SECRET, token, NOW + 60_001)).toBe(false);
  });

  it('is different every time', () => {
    expect(issueToken(SECRET, NOW)).not.toBe(issueToken(SECRET, NOW));
  });

  it('is refused when any part has been changed', () => {
    const [expires, nonce, signature] = issueToken(SECRET, NOW).split('.') as [string, string, string];
    const flipped = signature.slice(0, -1) + (signature.endsWith('A') ? 'B' : 'A');
    expect(verifyToken(SECRET, `${expires}.${nonce}.${flipped}`, NOW)).toBe(false);
    // Pushing the expiry later, to keep an old token alive.
    expect(verifyToken(SECRET, `${Number(expires) + 600_000}.${nonce}.${signature}`, NOW + 120_000)).toBe(false);
    expect(verifyToken(SECRET, `${expires}.${nonce}x.${signature}`, NOW)).toBe(false);
  });

  it('is refused when it was made with another secret, or there is no secret', () => {
    expect(verifyToken(SECRET, issueToken('another-secret', NOW), NOW)).toBe(false);
    expect(verifyToken('', issueToken('', NOW), NOW)).toBe(false);
  });

  it.each(['', 123, null, undefined, {}, 'a.b', 'a.b.c', '..', `${NOW + 1000}.nonce.`, 'x'.repeat(5000)])(
    'refuses %j without throwing',
    (token) => {
      expect(verifyToken(SECRET, token, NOW)).toBe(false);
    },
  );
});

describe('rate limit', () => {
  it('allows the limit, refuses the next, and allows again after the window', () => {
    const allow = createLimiter(10, 60_000);
    for (let call = 0; call < 10; call += 1) expect(allow('a', NOW + call)).toBe(true);
    expect(allow('a', NOW + 10)).toBe(false);
    expect(allow('a', NOW + 59_999)).toBe(false);
    expect(allow('a', NOW + 60_000)).toBe(true);
  });

  it('counts each client separately', () => {
    const allow = createLimiter(1, 60_000);
    expect(allow('a', NOW)).toBe(true);
    expect(allow('b', NOW)).toBe(true);
    expect(allow('a', NOW)).toBe(false);
  });

  it('never remembers more than 10,000 clients', () => {
    const allow = createLimiter(1, 60_000);
    for (let index = 0; index < 10_500; index += 1) allow(`client-${index}`, NOW);
    // The earliest were dropped to make room, so they start fresh; the latest are still counted.
    expect(allow('client-0', NOW)).toBe(true);
    expect(allow('client-10499', NOW)).toBe(false);
  });
});

describe('token address', () => {
  it('gives a token that the address address accepts', async () => {
    const response = handleToken(request('/api/contact/token'), env, NOW);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    expect(response.headers.get('content-type')).toContain('application/json');
    const { token } = await response.json();
    expect(verifyToken(SECRET, token, NOW)).toBe(true);
  });

  it('answers only POST', () => {
    const response = handleToken(request('/api/contact/token', { method: 'GET' }), env, NOW);
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });
});

describe('address address', () => {
  const body = async (response: Response) => JSON.stringify(await response.json());

  it('gives the address for a valid token, and never lets it be stored', async () => {
    const response = await handleAddress(withToken(issueToken(SECRET, NOW)), env, NOW + 1000);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ address: ADDRESS });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
  });

  it.each([
    ['no token', {}],
    ['an altered token', { token: `${issueToken(SECRET, NOW)}x` }],
    ['a token from another secret', { token: issueToken('another-secret', NOW) }],
    ['a token that is not text', { token: 42 }],
  ])('refuses %s, without the address', async (_name, payload) => {
    const response = await handleAddress(request('/api/contact/address', { body: JSON.stringify(payload) }), env, NOW);
    expect(response.status).toBe(403);
    expect(await body(response)).not.toContain('@');
  });

  it('refuses an expired token', async () => {
    const response = await handleAddress(withToken(issueToken(SECRET, NOW)), env, NOW + 60_001);
    expect(response.status).toBe(403);
    expect(await body(response)).not.toContain('@');
  });

  it.each([
    ['a body that is not JSON', '{oops'],
    ['an empty body', ''],
    ['a body that is not an object', '"text"'],
    ['an oversized body', JSON.stringify({ token: 'x'.repeat(5000) })],
  ])('answers 400 for %s', async (_name, raw) => {
    const response = await handleAddress(request('/api/contact/address', { body: raw }), env, NOW);
    expect(response.status).toBe(400);
    expect(await body(response)).not.toContain('@');
  });

  it('answers only POST', async () => {
    const response = await handleAddress(request('/api/contact/address', { method: 'GET' }), env, NOW);
    expect(response.status).toBe(405);
    expect(await body(response)).not.toContain('@');
  });
});

describe('both addresses', () => {
  const calls: [string, (request: Request, env: ContactEnv) => Response | Promise<Response>][] = [
    ['token', (req, settings) => handleToken(req, settings, NOW)],
    ['address', (req, settings) => handleAddress(req, settings, NOW)],
  ];

  it.each(calls)('%s: a request from another site is refused', async (name, call) => {
    const init = { headers: { origin: 'https://other.test' }, body: JSON.stringify({ token: issueToken(SECRET, NOW) }) };
    const response = await call(request(`/api/contact/${name}`, init), env);
    expect(response.status).toBe(403);
    expect(JSON.stringify(await response.json())).not.toContain('@');
  });

  it.each(calls)('%s: a request the browser marks as cross-site is refused', async (name, call) => {
    const init = { headers: { 'sec-fetch-site': 'cross-site' }, body: JSON.stringify({ token: issueToken(SECRET, NOW) }) };
    expect((await call(request(`/api/contact/${name}`, init), env)).status).toBe(403);
  });

  it.each(calls)('%s: missing settings answer 503 and leak nothing', async (name, call) => {
    for (const partial of [{}, { CONTACT_ADDRESS: ADDRESS }, { CONTACT_TOKEN_SECRET: SECRET }, { CONTACT_ADDRESS: '', CONTACT_TOKEN_SECRET: '' }]) {
      const response = await call(request(`/api/contact/${name}`, { body: JSON.stringify({ token: issueToken(SECRET, NOW) }) }), partial);
      expect(response.status).toBe(503);
      const text = JSON.stringify(await response.json());
      expect(text).toBe('{"error":"unavailable"}');
      expect(text).not.toContain(SECRET);
      expect(text).not.toContain('@');
    }
  });

  it.each(calls)('%s: the eleventh call in a minute from one client is refused', async (name, call) => {
    const ip = `198.51.100.${name === 'token' ? 1 : 2}`;
    const make = () => request(`/api/contact/${name}`, { ip, body: JSON.stringify({ token: issueToken(SECRET, NOW) }) });
    for (let index = 0; index < 10; index += 1) expect((await call(make(), env)).status).toBe(200);
    const refused = await call(make(), env);
    expect(refused.status).toBe(429);
    expect(JSON.stringify(await refused.json())).not.toContain('@');
  });

  it('no error anywhere holds a setting’s value', async () => {
    const responses = [
      handleToken(request('/api/contact/token', { method: 'PUT' }), env, NOW),
      await handleAddress(request('/api/contact/address', { body: '{oops' }), env, NOW),
      await handleAddress(withToken('nope'), env, NOW),
      await handleAddress(withToken(issueToken(SECRET, NOW), { headers: { origin: 'https://other.test' } }), env, NOW),
    ];
    for (const response of responses) {
      expect(response.status).toBeGreaterThanOrEqual(400);
      const text = JSON.stringify(await response.json());
      expect(text).not.toContain(SECRET);
      expect(text).not.toContain(ADDRESS);
    }
  });
});
