/*
 * Checks on the built site in dist/. Run `npm run build` first.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { EMAIL_PATTERN, readYaml, textFiles } from '../content/helpers';

const DIST = 'dist';
const JS_BUDGET_BYTES = 60 * 1024;

const built = textFiles(DIST);
// Redirect stubs (for example /projects) are not pages a visitor reads.
const pages = built.filter(([path, html]) => path.endsWith('.html') && !/http-equiv="refresh"/i.test(html));

describe('built site', () => {
  it('has been built', () => {
    expect(existsSync(join(DIST, 'index.html')), 'run `npm run build` first').toBe(true);
    expect(pages.length).toBeGreaterThanOrEqual(8);
  });

  it('home page ships at most 60 KB of compressed JavaScript', () => {
    const html = readFileSync(join(DIST, 'index.html'), 'utf8');
    const external = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((match) =>
      readFileSync(join(DIST, match[1]!.split('?')[0]!)),
    );
    const inline = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((match) =>
      Buffer.from(match[1] ?? ''),
    );
    const total = [...external, ...inline].reduce((sum, source) => sum + gzipSync(source).length, 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(JS_BUDGET_BYTES);
  });

  it('no page needs a third-party request to render', () => {
    // Anything the browser fetches by itself while rendering. Ordinary links
    // the visitor may click (<a href>) and the canonical link are fine.
    const loads = [
      /<script\b[^>]*\bsrc="(https?:)?\/\/[^"]+"/g,
      /<link\b(?=[^>]*\brel="(?:stylesheet|preload|modulepreload|preconnect|dns-prefetch|icon)")[^>]*\bhref="(https?:)?\/\/[^"]+"/g,
      /<(?:img|source|iframe|video|audio|embed)\b[^>]*\b(?:src|srcset)="(https?:)?\/\/[^"]+"/g,
    ];
    const cssLoads = /(?:url\(\s*["']?|@import\s+["'])(https?:)?\/\/[^)"']+/g;
    const external = built.flatMap(([path, text]) => {
      const patterns = path.endsWith('.css') ? [cssLoads] : path.endsWith('.html') ? [...loads, cssLoads] : [];
      return patterns.flatMap((pattern) => (text.match(pattern) ?? []).map((hit) => `${path}: ${hit}`));
    });
    expect(external).toEqual([]);
  });

  it('fonts are files on this site, and only one is fetched early', () => {
    const html = readFileSync(join(DIST, 'index.html'), 'utf8');
    const fontUrls = [...html.matchAll(/url\("([^"]+\.woff2)"\)/g)].map((match) => match[1]!);
    expect(fontUrls.length).toBeGreaterThanOrEqual(3);
    for (const url of fontUrls) {
      expect(url, url).toMatch(/^\/_astro\//);
      expect(existsSync(join(DIST, url)), url).toBe(true);
    }
    expect(html.match(/<link rel="preload"[^>]*as="font"/g)?.length).toBe(1);
  });

  it('no built file contains an email address', () => {
    const hits = built.flatMap(([path, text]) =>
      (text.match(EMAIL_PATTERN) ?? []).map((hit) => `${path}: ${hit}`),
    );
    expect(hits).toEqual([]);
  });

  it('test-only pages are marked noindex and nothing links to them', () => {
    const devPages = pages.filter(([path]) => path.startsWith(join(DIST, 'dev')));
    expect(devPages.length).toBeGreaterThan(0);
    for (const [path, html] of devPages) {
      expect(html, path).toMatch(/<meta name="robots" content="noindex"/);
    }
    const linking = pages.filter(([, html]) => /href="\/dev\//.test(html)).map(([path]) => path);
    expect(linking).toEqual([]);
  });

  it('every page has one h1, a description and a canonical address from site.yaml', () => {
    const origin = new URL(readYaml('src/content/site.yaml').main.url).origin;
    expect(origin).toBe('https://siddigz.com');
    for (const [path, html] of pages) {
      expect(html.match(/<h1[\s>]/g)?.length, `${path} h1 count`).toBe(1);
      expect(html, path).toMatch(/<meta name="description" content="[^"]+"/);
      expect(html, path).toContain(`<link rel="canonical" href="${origin}/`);
    }
  });
});
