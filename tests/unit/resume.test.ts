import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { handleResume, resumeEnabled } from '../../src/lib/resume';
import { blankPdf } from '../../scripts/make-placeholder-pdf.mjs';

const placeholder = new Uint8Array(readFileSync('src/assets/resume-placeholder.pdf'));
const NAME = 'Resume.pdf';
const ADDRESS = 'https://files.example.test/private/resume.pdf';
const text = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');
const pdf = (body: string) => new TextEncoder().encode(`%PDF-1.7\n${body}`);
const serving = (body: Uint8Array, status = 200) =>
  vi.fn(async () => new Response(body as Uint8Array<ArrayBuffer>, { status, headers: { 'content-type': 'application/pdf' } })) as unknown as typeof fetch;

describe('resumeEnabled', () => {
  it.each([undefined, '', 'TRUE', 'True', '1', 'yes', ' true'])('is off for %j', (value) => {
    expect(resumeEnabled({ RESUME_ENABLED: value })).toBe(false);
  });

  it('is on only for the exact word "true"', () => {
    expect(resumeEnabled({ RESUME_ENABLED: 'true' })).toBe(true);
  });
});

describe('handleResume', () => {
  it.each([undefined, 'TRUE', '1'])('answers 404 when the switch is %j, even with an address set', async (value) => {
    const fetchImpl = serving(pdf('real'));
    const response = await handleResume({ RESUME_ENABLED: value, RESUME_URL: ADDRESS }, placeholder, NAME, fetchImpl);
    expect(response.status).toBe(404);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('gives the blank placeholder when switched on with no address', async () => {
    const response = await handleResume({ RESUME_ENABLED: 'true' }, placeholder, NAME);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toBe('inline; filename="Resume.pdf"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    expect(text(new Uint8Array(await response.arrayBuffer())).startsWith('%PDF-')).toBe(true);
  });

  it('gives the file at the address when one is set', async () => {
    const real = pdf('the real one');
    const fetchImpl = serving(real);
    const response = await handleResume({ RESUME_ENABLED: 'true', RESUME_URL: ADDRESS }, placeholder, NAME, fetchImpl);
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(real);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((fetchImpl as any).mock.calls[0][0]).toBe(ADDRESS);
  });

  it.each([
    ['the fetch fails', vi.fn(async () => Promise.reject(new Error(`could not reach ${ADDRESS}`))) as unknown as typeof fetch],
    ['the file is missing', serving(pdf('gone'), 404)],
    ['the file is not a PDF', serving(new TextEncoder().encode('<html>Sign in</html>'))],
  ])('answers 404, without the address, when %s', async (_name, fetchImpl) => {
    const response = await handleResume({ RESUME_ENABLED: 'true', RESUME_URL: ADDRESS }, placeholder, NAME, fetchImpl);
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain('example.test');
  });

  it('answers 404 when the file says it is over 5 MB, without downloading it', async () => {
    let downloaded = false;
    const fetchImpl = vi.fn(async () => {
      const response = new Response(pdf('real') as Uint8Array<ArrayBuffer>, { headers: { 'content-length': String(6 * 1024 * 1024) } });
      Object.defineProperty(response, 'arrayBuffer', { value: async () => ((downloaded = true), new ArrayBuffer(0)) });
      return response;
    }) as unknown as typeof fetch;
    const response = await handleResume({ RESUME_ENABLED: 'true', RESUME_URL: ADDRESS }, placeholder, NAME, fetchImpl);
    expect(response.status).toBe(404);
    expect(downloaded).toBe(false);
  });

  it('answers 404 when the address leads somewhere that is not https', async () => {
    const fetchImpl = vi.fn(async () => {
      const response = new Response(pdf('real') as Uint8Array<ArrayBuffer>);
      Object.defineProperty(response, 'url', { value: 'http://elsewhere.example.test/resume.pdf' });
      return response;
    }) as unknown as typeof fetch;
    const response = await handleResume({ RESUME_ENABLED: 'true', RESUME_URL: ADDRESS }, placeholder, NAME, fetchImpl);
    expect(response.status).toBe(404);
  });

  it('answers 404 for an address that is not https, without asking for it', async () => {
    const fetchImpl = serving(pdf('real'));
    for (const address of ['http://files.example.test/resume.pdf', 'file:///etc/passwd', 'not an address']) {
      const response = await handleResume({ RESUME_ENABLED: 'true', RESUME_URL: address }, placeholder, NAME, fetchImpl);
      expect(response.status).toBe(404);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('the placeholder', () => {
  it('is a PDF under 1 KB that holds no text', () => {
    expect(placeholder.length).toBeLessThan(1024);
    const source = text(placeholder);
    expect(source.startsWith('%PDF-')).toBe(true);
    expect(source.trimEnd().endsWith('%%EOF')).toBe(true);
    // No text is drawn, no font is used and nothing describes an author.
    for (const marker of ['/Font', 'BT', 'Tj', '/Author', '/Title', '/Info']) expect(source, marker).not.toContain(marker);
  });

  it('is exactly what the script makes', () => {
    expect(Buffer.from(blankPdf()).equals(Buffer.from(placeholder))).toBe(true);
  });
});
