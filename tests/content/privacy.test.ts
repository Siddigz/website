import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { EMAIL_PATTERN, textFiles } from './helpers';

const sources = [...textFiles('src'), ...textFiles('public')];
const content = textFiles('src/content');

describe('privacy', () => {
  it('contains no email address', () => {
    const hits = sources.flatMap(([path, text]) => (text.match(EMAIL_PATTERN) ?? []).map((hit) => `${path}: ${hit}`));
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
    const mentions = content.flatMap(([path, text]) =>
      names.filter((name) => text.toLowerCase().includes(name.toLowerCase())).map((name) => `${path}: ${name}`),
    );
    expect(mentions).toEqual([]);
  });
});
