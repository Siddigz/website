/*
 * Checks on what other sites and search engines see: the link preview tags
 * and pictures, the sitemap, robots.txt and the structured data.
 * Run `npm run build` first.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { BUILT, explainerSlugs, featuredSlugs, pagePaths, readProjects, readYaml } from '../content/helpers';

const site = readYaml('src/content/site.yaml').main;
const ORIGIN = new URL(site.url).origin;
const fileFor = (path: string) => join(BUILT, path === '/' ? 'index.html' : `${path}/index.html`);
const pages = pagePaths().map((path) => ({ path, html: readFileSync(fileFor(path), 'utf8') }));
const meta = (html: string, property: string) =>
  new RegExp(`<meta (?:property|name)="${property}" content="([^"]*)"`).exec(html)?.[1]?.replaceAll('&amp;', '&').replaceAll('&#39;', "'").replaceAll('&quot;', '"');

describe('link previews', () => {
  it('there is a real page for every address the tests expect', () => {
    expect(pages.length).toBe(1 + featuredSlugs().length + explainerSlugs().length);
  });

  it.each(pages)('$path carries every tag a preview needs', ({ path, html }) => {
    const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
    expect(meta(html, 'og:url')).toBe(canonical);
    expect(canonical).toBe(`${ORIGIN}${path === '/' ? '/' : path}`);
    expect(meta(html, 'og:title')).toBe(/<title>([^<]*)<\/title>/.exec(html)?.[1]?.replaceAll('&amp;', '&'));
    expect(meta(html, 'og:description')).toBe(meta(html, 'description'));
    expect(meta(html, 'og:description')!.length).toBeGreaterThan(20);
    expect(meta(html, 'og:site_name')).toBe(`${site.name.first} ${site.name.last}`);
    expect(meta(html, 'og:type')).toBe(path === '/' ? 'website' : 'article');
    expect(meta(html, 'twitter:card')).toBe('summary_large_image');
    expect(meta(html, 'og:image:width')).toBe('1200');
    expect(meta(html, 'og:image:height')).toBe('630');
    expect(meta(html, 'og:image:alt')!.length).toBeGreaterThan(10);
  });

  it.each(pages)('$path points at a picture on this site that exists, is 1200 by 630 and is light', async ({ html }) => {
    const image = meta(html, 'og:image')!;
    expect(image.startsWith(`${ORIGIN}/og/`)).toBe(true);
    const file = join(BUILT, new URL(image).pathname);
    expect(existsSync(file), file).toBe(true);
    const { width, height, format } = await sharp(file).metadata();
    expect([width, height, format]).toEqual([1200, 630, 'png']);
    expect(statSync(file).size).toBeLessThan(300 * 1024);
  });

  it('there are seven pictures: the home page and each featured project', () => {
    const made = (readdirSync(join(BUILT, 'og'), { recursive: true }) as string[]).filter((name) => name.endsWith('.png')).sort();
    expect(made).toEqual(['home.png', ...featuredSlugs().map((slug) => join('projects', `${slug}.png`))].sort());
    expect(made.length).toBe(7);
  });

  it('each project page uses its own picture; the home page and the explainers share one', () => {
    for (const { path, html } of pages) {
      const expected = path.startsWith('/projects/') ? `${ORIGIN}/og${path}.png` : `${ORIGIN}/og/home.png`;
      expect(meta(html, 'og:image'), path).toBe(expected);
    }
  });

  it('a project’s preview says what the project is', () => {
    for (const project of readProjects().filter((entry) => featuredSlugs().includes(entry.slug))) {
      const html = readFileSync(fileFor(`/projects/${project.slug}`), 'utf8');
      expect(meta(html, 'og:description')).toBe(project.data.oneLiner);
      expect(meta(html, 'og:image:alt')).toContain(project.data.title);
    }
  });
});

describe('sitemap and robots.txt', () => {
  const index = readFileSync(join(BUILT, 'sitemap-index.xml'), 'utf8');
  const files = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!);
  const listed = files.flatMap((address) =>
    [...readFileSync(join(BUILT, new URL(address).pathname), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!),
  );

  it('lists exactly the real pages, on the site’s own address', () => {
    for (const address of files) expect(address.startsWith(`${ORIGIN}/`)).toBe(true);
    // Each page is listed at the address it calls its own.
    expect([...listed].sort()).toEqual(pagePaths().map((path) => `${ORIGIN}${path}`).sort());
  });

  it('lists no test page, picture, server address or not-found page', () => {
    for (const address of listed) expect(address).not.toMatch(/\/(dev|og|api)\/|404|resume/);
  });

  it('robots.txt lets everything in, keeps the server addresses out and points at the sitemap', () => {
    const robots = readFileSync(join(BUILT, 'robots.txt'), 'utf8');
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).toMatch(/^Disallow: \/api\/$/m);
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap-index.xml`);
  });
});

describe('structured data', () => {
  const home = readFileSync(fileFor('/'), 'utf8');
  const blocks = [...home.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]!));

  it('the home page describes one person, with the same links as the page', () => {
    expect(blocks.length).toBe(1);
    const person = blocks[0];
    expect(person['@context']).toBe('https://schema.org');
    expect(person['@type']).toBe('Person');
    expect(person.name).toBe(`${site.name.first} ${site.name.last}`);
    expect(person.url).toBe(`${ORIGIN}/`);
    expect(person.description).toBe(site.pitch);
    expect(person.sameAs).toEqual([site.links.github, site.links.linkedin]);
    expect(person.image.startsWith(`${ORIGIN}/`)).toBe(true);
    expect(existsSync(join(BUILT, new URL(person.image).pathname))).toBe(true);
  });

  it('holds no way to contact the person directly', () => {
    const text = JSON.stringify(blocks);
    for (const field of ['email', 'telephone', 'address', 'contactPoint']) expect(text).not.toContain(`"${field}"`);
    expect(text).not.toContain('@' + 'gmail');
  });

  it('other pages carry none', () => {
    for (const { path, html } of pages.slice(1)) expect(html, path).not.toContain('application/ld+json');
  });
});
