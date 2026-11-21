/*
 * Checks on the built site. Run `npm run build` first. The Vercel adapter puts
 * what the host serves in .vercel/output/static, and redirects are host rules
 * in .vercel/output/config.json, not pages.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { BUILT, EMAIL_PATTERN, readYaml, textFiles } from '../content/helpers';

const DIST = BUILT;
const JS_BUDGET_BYTES = 60 * 1024;

const built = textFiles(DIST);
const pages = built.filter(([path]) => path.endsWith('.html'));

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

  it('fonts are files on this site, and only the two in use are fetched early', () => {
    const html = readFileSync(join(DIST, 'index.html'), 'utf8');
    const fontUrls = [...html.matchAll(/url\("([^"]+\.woff2)"\)/g)].map((match) => match[1]!);
    expect(fontUrls.length).toBe(2);
    for (const url of fontUrls) {
      expect(url, url).toMatch(/^\/_astro\//);
      expect(existsSync(join(DIST, url)), url).toBe(true);
    }
    expect(html.match(/<link rel="preload"[^>]*as="font"/g)?.length).toBe(2);
  });

  it('no built file holds a mail link, in the pages or in the server function', () => {
    // The Email button fetches the address when pressed, and puts the link together then.
    const everything = [...built, ...textFiles(join(BUILT, '..', 'functions'))];
    expect(everything.length).toBeGreaterThan(built.length);
    const hits = everything.filter(([, text]) => text.includes('mailto:')).map(([path]) => path);
    expect(hits).toEqual([]);
  });

  it('the two email addresses are answered by the server, not built ahead of time', () => {
    const { routes } = JSON.parse(readFileSync(join(BUILT, '..', 'config.json'), 'utf8'));
    for (const path of ['/api/contact/token', '/api/contact/address']) {
      expect(existsSync(join(DIST, path)), path).toBe(false);
      expect(routes.some((route: any) => route.dest === '_render' && new RegExp(route.src).test(path)), path).toBe(true);
    }
  });

  it('no built file contains an email address', () => {
    const hits = built.flatMap(([path, text]) =>
      (text.match(EMAIL_PATTERN) ?? []).map((hit) => `${path}: ${hit}`),
    );
    expect(hits).toEqual([]);
  });

  it('a normal build holds no test-only page, and nothing links to one', () => {
    expect(existsSync(join(DIST, 'dev')), 'run `npm run build` first, not the test build').toBe(false);
    const linking = built.filter(([, text]) => /["'(]\/dev\//.test(text)).map(([path]) => path);
    expect(linking).toEqual([]);
  });

  it('the bare /projects address is a redirect rule, not a page', () => {
    expect(existsSync(join(DIST, 'projects', 'index.html'))).toBe(false);
    const { routes } = JSON.parse(readFileSync(join(BUILT, '..', 'config.json'), 'utf8'));
    const rule = routes.find((route: any) => route.headers?.Location === '/#projects');
    expect(rule?.status).toBe(301);
    expect(new RegExp(rule.src).test('/projects')).toBe(true);
  });

  it('a build with no GitHub token leaves the activity section out, and nothing points at it', () => {
    // `npm run build` is the build that ships. Test builds (`npm run build:test`) add sample data.
    const html = readFileSync(join(DIST, 'index.html'), 'utf8');
    if (process.env.GITHUB_ACTIVITY_TOKEN) return;
    expect(html, 'run `npm run build` first, not the test build').not.toContain('id="activity"');
    expect(html).not.toContain('#activity');
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
