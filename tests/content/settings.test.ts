import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { textFiles } from './helpers';

const example = readFileSync('.env.example', 'utf8');
const checklist = readFileSync('docs/vercel-checklist.md', 'utf8');

// A setting is read either straight from the environment or from the bag of
// settings a server function is handed (`env.NAME`, or a `NAME?: string` field).
const code = textFiles('src').filter(([path]) => /\.(ts|astro|mjs|js)$/.test(path));
const read = new Set(
  code.flatMap(([, text]) => [
    ...[...text.matchAll(/\benv\.([A-Z][A-Z0-9_]+)\b/g)].map((match) => match[1]!),
    ...[...text.matchAll(/^\s*([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\?: string/gm)].map((match) => match[1]!),
  ]),
);
// Switches the build tools set themselves; nobody enters these on the host.
const BUILT_IN = ['SITE_FIXTURES', 'VERCEL'];
const settings = [...read].filter((name) => !BUILT_IN.includes(name)).sort();

describe('private settings', () => {
  it('the code reads the ones this test expects to find', () => {
    expect(settings).toEqual([
      'CONTACT_ADDRESS',
      'CONTACT_TOKEN_SECRET',
      'CRON_SECRET',
      'DEPLOY_HOOK_URL',
      'GITHUB_ACTIVITY_TOKEN',
      'RESUME_ENABLED',
      'RESUME_URL',
    ]);
  });

  it.each(settings)('%s is named in .env.example and in the hosting checklist', (name) => {
    expect(example).toMatch(new RegExp(`^${name}=$`, 'm'));
    expect(checklist).toContain(`\`${name}\``);
  });

  it('.env.example names settings and holds no values', () => {
    const lines = example.split('\n').filter((line) => line.trim() && !line.startsWith('#'));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).toMatch(/^[A-Z][A-Z0-9_]*=$/);
    expect(lines.map((line) => line.slice(0, -1)).sort()).toEqual(settings);
  });

  it('the checklist and the README hold no value either: no address, token or hook', () => {
    for (const [name, text] of [['checklist', checklist], ['README', readFileSync('README.md', 'utf8')]] as const) {
      expect(text, name).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/);
      expect(text, name).not.toMatch(/\b[0-9a-f]{32,}\b/);
      expect(text, name).not.toMatch(/api\.vercel\.com\/v1\/integrations\/deploy/);
    }
  });
});
