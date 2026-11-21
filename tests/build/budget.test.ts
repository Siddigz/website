/*
 * Checks on the built site. Run `npm run build` first. The Vercel adapter puts
 * what the host serves in .vercel/output/static, and redirects are host rules
 * in .vercel/output/config.json, not pages.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
    // The host's analytics script is not counted (rule 12), and only exists on the host.
    const external = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)]
      .map((match) => match[1]!.split('?')[0]!)
      .filter((src) => !src.startsWith('/_vercel/'))
      .map((src) => readFileSync(join(DIST, src)));
    const inline = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((match) =>
      Buffer.from(match[1] ?? ''),
    );
    const total = [...external, ...inline].reduce((sum, source) => sum + gzipSync(source).length, 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(JS_BUDGET_BYTES);
  });

  it('a build made anywhere but on the host asks for no analytics script', () => {
    if (process.env.VERCEL === '1') return;
    const asking = built.filter(([, text]) => text.includes('/_vercel/')).map(([path]) => path);
    expect(asking).toEqual([]);
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

  it('no built file holds a mail link with an address in it, in the pages or in the server function', () => {
    // The Email button fetches the address when pressed. Its script holds only the bare prefix.
    const everything = [...built, ...textFiles(join(BUILT, '..', 'functions'))];
    expect(everything.length).toBeGreaterThan(built.length);
    const hits = everything.filter(([, text]) => /mailto:[^"'`\s)]*@/.test(text) || /href=["']mailto:/.test(text)).map(([path]) => path);
    expect(hits).toEqual([]);
  });

  it('the server function cannot be made to resize pictures: every picture is made at build time', () => {
    // The framework's on-request picture endpoint is replaced by one that answers "not found",
    // so the picture library is not even part of what runs on the server.
    const modules = join(BUILT, '..', 'functions', '_render.func', 'node_modules');
    expect(existsSync(join(modules, 'sharp'))).toBe(false);
    expect(existsSync(join(modules, '@img'))).toBe(false);
  });

  it('the email addresses and the daily rebuild are answered by the server, not built ahead of time', () => {
    const { routes } = JSON.parse(readFileSync(join(BUILT, '..', 'config.json'), 'utf8'));
    for (const path of ['/api/contact/token', '/api/contact/address', '/api/rebuild']) {
      expect(existsSync(join(DIST, path)), path).toBe(false);
      expect(routes.some((route: any) => route.dest === '_render' && new RegExp(route.src).test(path)), path).toBe(true);
    }
  });

  it('the resume is answered by the server, and a normal build neither holds a file for it nor links to it', () => {
    expect(existsSync(join(DIST, 'resume.pdf'))).toBe(false);
    const pdfs = (readdirSync(DIST, { recursive: true }) as string[]).filter((path) => path.endsWith('.pdf'));
    expect(pdfs).toEqual([]);
    const { routes } = JSON.parse(readFileSync(join(BUILT, '..', 'config.json'), 'utf8'));
    expect(routes.some((route: any) => route.dest === '_render' && new RegExp(route.src).test('/resume.pdf'))).toBe(true);
    if (process.env.RESUME_ENABLED === 'true') return;
    const linking = pages.filter(([, html]) => /href="[^"]*resume/i.test(html)).map(([path]) => path);
    expect(linking).toEqual([]);
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

  it('no script sent to the browser can evaluate text as code, or carries a library meant for the build', () => {
    const scripts = [
      ...built.filter(([path]) => path.endsWith('.js')),
      ...pages.flatMap(([path, html]) =>
        [...html.matchAll(/<script\b(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g)].map((match): [string, string] => [path, match[1] ?? '']),
      ),
    ];
    expect(scripts.length).toBeGreaterThan(5);
    const evaluating = scripts.filter(([, text]) => /\beval\(|\bFunction\(/.test(text)).map(([path]) => path);
    expect([...new Set(evaluating)]).toEqual([]);
    // No single script is large: each feature's script is a few kilobytes.
    const heavy = scripts.filter(([, text]) => text.length > 20_000).map(([path, text]) => `${path}: ${text.length} bytes`);
    expect(heavy).toEqual([]);
  });

  describe('content security policy', () => {
    const policyOf = (html: string) =>
      /<meta http-equiv="content-security-policy" content="([^"]*)"/i.exec(html)?.[1]?.replaceAll('&#39;', "'").replaceAll('&apos;', "'") ?? '';
    const rule = (policy: string, name: string) =>
      policy
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name} `))
        ?.slice(name.length + 1) ?? null;

    it('every page carries one, with the same fixed rules', () => {
      for (const [path, html] of pages) {
        const policy = policyOf(html);
        expect(policy, path).not.toBe('');
        expect(rule(policy, 'default-src'), path).toBe("'self'");
        expect(rule(policy, 'img-src'), path).toBe("'self' data:");
        expect(rule(policy, 'font-src'), path).toBe("'self'");
        expect(rule(policy, 'media-src'), path).toBe("'self'");
        expect(rule(policy, 'connect-src'), path).toBe("'self'");
        expect(rule(policy, 'object-src'), path).toBe("'none'");
        expect(rule(policy, 'base-uri'), path).toBe("'self'");
        expect(rule(policy, 'form-action'), path).toBe("'none'");
      }
    });

    it('scripts and styles are allowed one by one, by their hash: nothing typed into a page can run', () => {
      for (const [path, html] of pages) {
        const policy = policyOf(html);
        for (const name of ['script-src', 'style-src']) {
          const value = rule(policy, name) ?? '';
          expect(value, `${path} ${name}`).toMatch(/'sha256-[A-Za-z0-9+/=]+'/);
          expect(value, `${path} ${name}`).not.toContain("'unsafe-inline'");
          expect(value, `${path} ${name}`).not.toContain("'unsafe-eval'");
          expect(value, `${path} ${name}`).not.toMatch(/https?:|\*/);
        }
      }
    });

    it('no page relies on a style attribute or a script attribute, which the policy would block', () => {
      const offending = pages.filter(([, html]) => /<[^>]+\s(style|on[a-z]+)="/i.test(html.replace(/<script[\s\S]*?<\/script>/g, ''))).map(([path]) => path);
      expect(offending).toEqual([]);
    });
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
