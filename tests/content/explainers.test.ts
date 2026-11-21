import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { readMarkdown, readYaml, textFiles } from './helpers';

const DIR = 'src/content/explainers';
const files = readdirSync(DIR).filter((name) => name.endsWith('.md'));
const explainers = files.map((name) => ({ slug: name.replace(/\.md$/, ''), ...readMarkdown(`${DIR}/${name}`) }));

// Everything that makes up an explainer: its content file, its drawing, its logic and its script.
const sources = [
  ...textFiles(DIR),
  ...textFiles('src/components/explainers'),
  ...textFiles('src/lib/explainers'),
  ...textFiles('src/scripts/explainers'),
];

describe('explainers', () => {
  it('each has a title, a one-sentence summary and a place in the order', () => {
    expect(explainers.length).toBeGreaterThan(0);
    for (const { slug, data } of explainers) {
      expect(data.title, slug).toEqual(expect.any(String));
      expect(data.summary, slug).toMatch(/^[A-Z].*\.$/);
      expect(data.order, slug).toEqual(expect.any(Number));
    }
    const orders = explainers.map(({ data }) => data.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('take every colour from the design tokens', () => {
    const hits = sources.flatMap(([path, text]) => (text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map((hit) => `${path}: ${hit}`));
    expect(hits).toEqual([]);
    const raw = sources.flatMap(([path, text]) => (text.match(/\b(?:rgb|hsl|oklch)a?\(/g) ?? []).map((hit) => `${path}: ${hit}`));
    expect(raw).toEqual([]);
  });

  it('name no employer, and no company at all (rule 6)', () => {
    const organisations: string[] = Object.values(readYaml('src/content/experience.yaml')).map((entry: any) => entry.organisation);
    expect(organisations.length).toBeGreaterThan(0);
    // The company the packet explainer's first draft named, written in two parts so this file does not name it either.
    const removed = ['Goo', 'gle'].join('');
    for (const [path, text] of sources) {
      for (const name of [...organisations, removed]) expect(text.toLowerCase(), `${path} names ${name}`).not.toContain(name.toLowerCase());
    }
  });
});
