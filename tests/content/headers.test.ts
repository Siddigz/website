import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const { headers } = JSON.parse(readFileSync('vercel.json', 'utf8'));

describe('security headers', () => {
  it('are sent with every address, and are exactly these', () => {
    expect(headers.length).toBe(1);
    expect(headers[0].source).toBe('/(.*)');
    const sent = Object.fromEntries(headers[0].headers.map(({ key, value }: { key: string; value: string }) => [key, value]));
    expect(sent).toEqual({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Strict-Transport-Security': 'max-age=63072000',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
  });
});
