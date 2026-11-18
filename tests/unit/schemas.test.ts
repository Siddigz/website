import { describe, it, expect } from 'vitest';
import { z } from 'astro/zod';
import { projectSchema, experienceSchema, siteSchema } from '../../src/content/schemas';

const schema = projectSchema(() => z.string());
const base = {
  title: 'X',
  oneLiner: 'Does X.',
  category: 'web-apps',
  stack: ['TypeScript'],
  date: '2026-01',
  links: { repo: 'https://github.com/Siddigz/x' },
};

describe('projectSchema', () => {
  it('accepts a project with only required fields', () => {
    expect(schema.safeParse(base).success).toBe(true);
  });
  it('rejects an unknown category', () => {
    expect(schema.safeParse({ ...base, category: 'games' }).success).toBe(false);
  });
  it('rejects a repo outside the owner account', () => {
    expect(schema.safeParse({ ...base, links: { repo: 'https://github.com/other/x' } }).success).toBe(false);
  });
  it('rejects an extra repo outside the owner account', () => {
    const links = { repo: base.links.repo, extraRepos: ['https://github.com/other/y'] };
    expect(schema.safeParse({ ...base, links }).success).toBe(false);
  });
  it('rejects a featured project without result, cover and coverAlt', () => {
    expect(schema.safeParse({ ...base, featured: 1 }).success).toBe(false);
    expect(schema.safeParse({ ...base, featured: 1, result: 'Won.', cover: './c.png', coverAlt: 'c' }).success).toBe(true);
  });
  it('rejects a cover with no alt text', () => {
    expect(schema.safeParse({ ...base, cover: './c.png' }).success).toBe(false);
  });
  it('rejects a malformed date', () => {
    expect(schema.safeParse({ ...base, date: 'Jan 2026' }).success).toBe(false);
  });
  it('accepts only known cover fits', () => {
    const withCover = { ...base, cover: './c.png', coverAlt: 'c' };
    expect(schema.safeParse({ ...withCover, coverFit: 'contain' }).success).toBe(true);
    expect(schema.safeParse({ ...withCover, coverFit: 'stretch' }).success).toBe(false);
    expect(schema.parse(withCover).coverFit).toBe('cover');
  });
  it('rejects an empty stack', () => {
    expect(schema.safeParse({ ...base, stack: [] }).success).toBe(false);
  });
});

describe('experienceSchema', () => {
  const role = { organisation: 'Org', title: 'Intern', team: 'Team', start: '2026-01', order: 1 };
  it('accepts a role with no end date', () => {
    expect(experienceSchema.safeParse(role).success).toBe(true);
  });
  it('rejects a description', () => {
    expect(experienceSchema.safeParse({ ...role, description: 'Did things' }).success).toBe(false);
  });
});

describe('siteSchema', () => {
  it('requires the looking-for switch to be a boolean', () => {
    const site = {
      url: 'https://siddigz.com',
      name: { first: 'A', last: 'B' },
      pitch: 'p',
      lookingFor: { enabled: 'yes', text: 't' },
      school: 's',
      gpa: 'g',
      expectedGraduation: 'e',
      links: { github: 'https://github.com/Siddigz', linkedin: 'https://linkedin.com/in/x' },
      contactNote: 'Say hello.',
      home: { city: 'Ottawa', timeZone: 'America/Toronto' },
    };
    expect(siteSchema.safeParse(site).success).toBe(false);
    expect(siteSchema.safeParse({ ...site, lookingFor: { enabled: false, text: 't' } }).success).toBe(true);
  });
});
