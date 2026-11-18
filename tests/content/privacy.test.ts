import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { EMAIL_PATTERN, textFiles } from './helpers';

const content = textFiles('src/content');

// Every tracked text file, not only src/: docs, configs, workflows and tests
// are public too. The lockfile is third-party package metadata.
const TEXT = new Set(['.astro', '.ts', '.js', '.mjs', '.css', '.md', '.yaml', '.yml', '.json', '.html', '.svg', '.txt', '.xml', '']);
const tracked = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .filter((path) => path && path !== 'package-lock.json' && TEXT.has(extname(path)) && existsSync(path))
  .map((path): [string, string] => [path, readFileSync(path, 'utf8')]);

describe('privacy', () => {
  it('no tracked file contains an email address', () => {
    expect(tracked.length).toBeGreaterThan(30);
    const hits = tracked.flatMap(([path, text]) =>
      (text.match(EMAIL_PATTERN) ?? []).map((hit) => `${path}: ${hit}`),
    );
    expect(hits).toEqual([]);
  });

  it("links only the owner's public repositories", () => {
    const foreign = content.flatMap(([path, text]) =>
      (text.match(/https?:\/\/github\.com\/[^\s"')>]+/g) ?? [])
        .filter((url) => !url.startsWith('https://github.com/Siddigz'))
        .map((url) => `${path}: ${url}`),
    );
    expect(foreign).toEqual([]);
  });

  // The list of projects left off the site is private, so it lives in the
  // git-ignored CLAUDE.local.md. Where that file is absent (CI), this skips.
  it.skipIf(!existsSync('CLAUDE.local.md'))('does not mention projects that are deliberately left off', () => {
    const notes = readFileSync('CLAUDE.local.md', 'utf8');
    const line = /Do not feature or link:([\s\S]*?)\. Do not link/.exec(notes)?.[1] ?? '';
    const names = line.split(',').map((name) => name.replace(/\s+/g, ' ').trim()).filter(Boolean);
    expect(names.length).toBeGreaterThan(0);
    const mentions = tracked.flatMap(([path, text]) =>
      names.filter((name) => text.toLowerCase().includes(name.toLowerCase())).map((name) => `${path}: ${name}`),
    );
    expect(mentions).toEqual([]);
  });

  it('keeps the owner name out of components, pages and layouts', () => {
    // Rule 25: content comes from src/content/, never from a component.
    const code = [...textFiles('src/components'), ...textFiles('src/pages'), ...textFiles('src/layouts')];
    const hits = code.filter(([, text]) => /Siddig|Ahmed/.test(text)).map(([path]) => path);
    expect(hits).toEqual([]);
  });
});
